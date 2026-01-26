import { type Guild, ChannelType, type AnyThreadChannel, type Message, MessageType } from "discord.js";
import {
  getDb,
  upsertServer,
  upsertChannel,
  upsertUser,
  upsertTag,
  createThread,
  createMessage,
  createAttachments,
  setThreadTags,
  createSyncLog,
  updateSyncLog,
  getThreadById,
  upsertReaction,
  upsertThreadParticipant,
  servers,
  eq,
} from "@discolink/db";
import { logger } from "../logger.js";
import { getConfig } from "../config.js";
import { parseDiscordMarkdown } from "../lib/markdown.js";

// Map Discord message types to string identifiers for system messages
function getSystemMessageType(type: MessageType): string | null {
  const systemTypes: Record<number, string> = {
    [MessageType.RecipientAdd]: "recipient_add",
    [MessageType.RecipientRemove]: "recipient_remove",
    [MessageType.Call]: "call",
    [MessageType.ChannelNameChange]: "channel_name_change",
    [MessageType.ChannelIconChange]: "channel_icon_change",
    [MessageType.ChannelPinnedMessage]: "pinned_message",
    [MessageType.UserJoin]: "user_join",
    [MessageType.GuildBoost]: "guild_boost",
    [MessageType.GuildBoostTier1]: "guild_boost_tier_1",
    [MessageType.GuildBoostTier2]: "guild_boost_tier_2",
    [MessageType.GuildBoostTier3]: "guild_boost_tier_3",
    [MessageType.ChannelFollowAdd]: "channel_follow_add",
    [MessageType.ThreadCreated]: "thread_created",
    [MessageType.Reply]: "reply",
    [MessageType.ChatInputCommand]: "chat_input_command",
    [MessageType.ThreadStarterMessage]: "thread_starter_message",
    [MessageType.ContextMenuCommand]: "context_menu_command",
    [MessageType.AutoModerationAction]: "auto_moderation_action",
  };
  return systemTypes[type] ?? null;
}

export async function queueInitialSync(guild: Guild): Promise<void> {
  const db = getDb();

  // Create sync log entry
  const syncLogEntry = await createSyncLog(db, {
    serverId: guild.id,
    type: "initial",
    status: "started",
    itemsSynced: 0,
  });

  let itemsSynced = 0;

  try {
    logger.info(`Starting initial sync for guild: ${guild.name}`, { guildId: guild.id });

    // Update server record
    await upsertServer(db, {
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      description: guild.description,
      isActive: true,
    });

    // Sync all channels
    for (const [, channel] of guild.channels.cache) {
      if ("name" in channel) {
        await upsertChannel(db, {
          id: channel.id,
          serverId: guild.id,
          parentId: channel.parentId,
          name: channel.name,
          type: channel.type,
          topic: "topic" in channel ? channel.topic : null,
          position: "position" in channel ? channel.position : 0,
          isNsfw: "nsfw" in channel ? channel.nsfw : false,
        });
        itemsSynced++;
      }
    }

    // Find forum channels and sync their tags
    const forumChannels = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildForum || c.type === ChannelType.GuildMedia
    );

    for (const [, channel] of forumChannels) {
      if ("availableTags" in channel) {
        for (const tag of channel.availableTags) {
          await upsertTag(db, {
            id: tag.id,
            channelId: channel.id,
            name: tag.name,
            emoji: tag.emoji?.name ?? tag.emoji?.id ?? null,
            isModerated: tag.moderated,
          });
          itemsSynced++;
        }
      }
    }

    // Fetch and sync active threads
    const activeThreads = await guild.channels.fetchActiveThreads();
    for (const [, thread] of activeThreads.threads) {
      await syncThread(thread);
      itemsSynced++;
    }

    // Fetch and sync archived threads from forum channels
    for (const [, channel] of forumChannels) {
      if ("threads" in channel) {
        let hasMore = true;
        let before: string | undefined = undefined;

        while (hasMore) {
          const fetchOptions: { limit: number; before?: string } = { limit: 100 };
          if (before) {
            fetchOptions.before = before;
          }

          const archivedThreads = await channel.threads.fetchArchived(fetchOptions);

          for (const [, thread] of archivedThreads.threads) {
            await syncThread(thread);
            itemsSynced++;
          }

          hasMore = archivedThreads.hasMore;
          const lastThread = archivedThreads.threads.last();
          if (lastThread) {
            before = lastThread.id;
          } else {
            hasMore = false;
          }
        }
      }
    }

    // Update sync log
    await updateSyncLog(db, syncLogEntry.id, {
      status: "completed",
      itemsSynced,
      completedAt: new Date(),
    });

    // Update server last sync time
    await db
      .update(servers)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(servers.id, guild.id));

    logger.info(`Initial sync completed for guild: ${guild.name}`, {
      guildId: guild.id,
      itemsSynced,
    });
  } catch (error) {
    logger.error(`Initial sync failed for guild: ${guild.name}`, {
      guildId: guild.id,
      error: error instanceof Error ? error.message : String(error),
    });

    await updateSyncLog(db, syncLogEntry.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    });

    throw error;
  }
}

async function syncThread(thread: AnyThreadChannel): Promise<void> {
  const db = getDb();

  logger.debug(`Syncing thread: ${thread.name}`, { threadId: thread.id });

  try {
    // Ensure author exists with full profile data
    if (thread.ownerId) {
      const owner = await thread.guild?.members.fetch(thread.ownerId).catch(() => null);
      if (owner) {
        await upsertUser(db, {
          id: owner.id,
          username: owner.user.username,
          globalName: owner.user.globalName,
          discriminator: owner.user.discriminator,
          avatar: owner.user.avatar,
          banner: owner.user.banner,
          accentColor: owner.user.accentColor,
          isBot: owner.user.bot,
          flags: owner.user.flags?.bitfield,
          publicFlags: owner.user.flags?.bitfield,
        });
      }
    }

    // Check if thread already exists
    const existingThread = await getThreadById(db, thread.id);
    if (!existingThread) {
      // Create thread record
      await createThread(db, {
        id: thread.id,
        serverId: thread.guildId!,
        channelId: thread.parentId!,
        authorId: thread.ownerId!,
        title: thread.name,
        visibility: thread.type === ChannelType.PrivateThread ? "private" : "public",
        isArchived: thread.archived ?? false,
        isLocked: thread.locked ?? false,
        autoArchiveDuration: thread.autoArchiveDuration ?? undefined,
      });
    }

    // Sync forum tags
    if (thread.appliedTags.length > 0) {
      await setThreadTags(db, thread.id, thread.appliedTags);
    }

    // Fetch and sync messages
    await syncThreadMessages(thread);
  } catch (error) {
    logger.error(`Failed to sync thread: ${thread.name}`, {
      threadId: thread.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function syncThreadMessages(thread: AnyThreadChannel): Promise<void> {
  let lastMessageId: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const fetchOptions: { limit: number; before?: string } = { limit: 100 };
    if (lastMessageId) {
      fetchOptions.before = lastMessageId;
    }

    const fetchedMessages = await thread.messages.fetch(fetchOptions);

    if (fetchedMessages.size === 0) {
      hasMore = false;
      break;
    }

    for (const [, message] of fetchedMessages) {
      await syncMessage(message, thread);
    }

    const lastMsg = fetchedMessages.last();
    lastMessageId = lastMsg?.id;
    hasMore = fetchedMessages.size === 100;
  }
}

async function syncMessage(message: Message, thread: AnyThreadChannel): Promise<void> {
  const db = getDb();
  const config = getConfig();

  // Skip bot messages if configured to do so
  if (message.author.bot && !config.SYNC_BOT_MESSAGES) return;

  try {
    // Ensure author exists with full profile data
    await upsertUser(db, {
      id: message.author.id,
      username: message.author.username,
      globalName: message.author.globalName,
      discriminator: message.author.discriminator,
      avatar: message.author.avatar,
      banner: message.author.banner,
      accentColor: message.author.accentColor,
      isBot: message.author.bot,
      flags: message.author.flags?.bitfield,
      publicFlags: message.author.flags?.bitfield,
    });

    // Capture embeds
    const embeds = message.embeds.length > 0
      ? JSON.stringify(message.embeds.map((e) => ({
          type: e.data.type,
          title: e.title,
          description: e.description,
          url: e.url,
          timestamp: e.timestamp,
          color: e.color,
          footer: e.footer ? { text: e.footer.text, iconURL: e.footer.iconURL } : null,
          image: e.image ? { url: e.image.url, width: e.image.width, height: e.image.height } : null,
          thumbnail: e.thumbnail ? { url: e.thumbnail.url, width: e.thumbnail.width, height: e.thumbnail.height } : null,
          author: e.author ? { name: e.author.name, url: e.author.url, iconURL: e.author.iconURL } : null,
          fields: e.fields?.map((f) => ({ name: f.name, value: f.value, inline: f.inline })),
          video: e.video ? { url: e.video.url, width: e.video.width, height: e.video.height } : null,
          provider: e.provider ? { name: e.provider.name, url: e.provider.url } : null,
        })))
      : null;

    // Capture components
    const components = message.components.length > 0
      ? JSON.stringify(message.components.map((c) => c.toJSON()))
      : null;

    // Capture stickers
    const stickers = message.stickers.size > 0
      ? JSON.stringify([...message.stickers.values()].map((s) => ({
          id: s.id,
          name: s.name,
          formatType: s.format,
          description: s.description,
          tags: s.tags,
        })))
      : null;

    // Parse mentions
    const mentionedUserIds = message.mentions.users.size > 0
      ? JSON.stringify([...message.mentions.users.keys()])
      : null;

    const mentionedRoleIds = message.mentions.roles.size > 0
      ? JSON.stringify([...message.mentions.roles.keys()])
      : null;

    const mentionedChannelIds = message.mentions.channels.size > 0
      ? JSON.stringify([...message.mentions.channels.keys()])
      : null;

    // Parse content to HTML
    const contentHtml = message.content ? parseDiscordMarkdown(message.content) : null;

    // Create message record with rich content
    await createMessage(db, {
      id: message.id,
      threadId: thread.id,
      channelId: thread.parentId!,
      serverId: message.guildId!,
      authorId: message.author.id,
      content: message.content,
      contentHtml,
      replyToId: message.reference?.messageId ?? null,
      type: message.type,
      flags: message.flags.bitfield,
      embeds,
      components,
      stickers,
      mentionedUserIds,
      mentionedRoleIds,
      mentionedChannelIds,
      systemMessageType: getSystemMessageType(message.type),
      webhookId: message.webhookId,
      applicationId: message.applicationId,
    });

    // Store attachments with extended fields
    if (message.attachments.size > 0) {
      const attachmentData = message.attachments.map((att) => ({
        id: att.id,
        messageId: message.id,
        filename: att.name,
        url: att.url,
        proxyUrl: att.proxyURL,
        contentType: att.contentType,
        size: att.size,
        width: att.width,
        height: att.height,
        isImage: att.contentType?.startsWith("image/") ?? false,
        isVideo: att.contentType?.startsWith("video/") ?? false,
        isSpoiler: att.spoiler,
        description: att.description,
        duration: att.duration,
        waveform: att.waveform,
        attachmentFlags: att.flags?.bitfield,
      }));

      await createAttachments(db, attachmentData);
    }

    // Sync reactions for this message
    if (message.reactions.cache.size > 0) {
      for (const [, reaction] of message.reactions.cache) {
        const emoji = reaction.emoji;
        const emojiUrl = emoji.id
          ? `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}`
          : null;

        await upsertReaction(db, {
          messageId: message.id,
          emoji: emoji.id ?? emoji.name ?? "unknown",
          emojiName: emoji.name,
          isCustom: !!emoji.id,
          isAnimated: emoji.animated ?? false,
          emojiUrl,
          guildId: emoji.id ? (message.guild?.id ?? null) : null,
          count: reaction.count,
        });
      }
    }

    // Track thread participant
    await upsertThreadParticipant(db, {
      threadId: thread.id,
      userId: message.author.id,
      isBot: message.author.bot ?? false,
      lastMessageAt: message.createdAt,
      incrementMessageCount: true,
    });
  } catch (error) {
    // Log but don't throw - continue syncing other messages
    logger.debug(`Failed to sync message`, {
      messageId: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function runBackfill(
  guild: Guild,
  days: number
): Promise<{ threadsProcessed: number; messagesProcessed: number }> {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const syncLogEntry = await createSyncLog(db, {
    serverId: guild.id,
    type: "backfill",
    status: "started",
    metadata: { days },
  });

  let threadsProcessed = 0;
  let messagesProcessed = 0;

  try {
    logger.info(`Starting backfill for guild: ${guild.name}`, { guildId: guild.id, days });

    // Get all forum channels
    const forumChannels = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildForum || c.type === ChannelType.GuildMedia
    );

    for (const [, channel] of forumChannels) {
      if ("threads" in channel) {
        // Fetch archived threads
        let hasMore = true;
        let before: string | undefined = undefined;

        while (hasMore) {
          const fetchOptions: { limit: number; before?: string } = { limit: 100 };
          if (before) {
            fetchOptions.before = before;
          }

          const archivedThreads = await channel.threads.fetchArchived(fetchOptions);

          for (const [, thread] of archivedThreads.threads) {
            // Skip if thread is older than cutoff
            if (thread.createdAt && thread.createdAt < cutoffDate) {
              hasMore = false;
              break;
            }

            await syncThread(thread);
            threadsProcessed++;

            // Count messages (approximate)
            messagesProcessed += thread.messageCount ?? 0;
          }

          if (archivedThreads.threads.size < 100) {
            hasMore = false;
          } else {
            const lastThread = archivedThreads.threads.last();
            before = lastThread?.id;
          }
        }
      }
    }

    await updateSyncLog(db, syncLogEntry.id, {
      status: "completed",
      itemsSynced: threadsProcessed + messagesProcessed,
      completedAt: new Date(),
    });

    logger.info(`Backfill completed for guild: ${guild.name}`, {
      guildId: guild.id,
      threadsProcessed,
      messagesProcessed,
    });

    return { threadsProcessed, messagesProcessed };
  } catch (error) {
    await updateSyncLog(db, syncLogEntry.id, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    });

    throw error;
  }
}
