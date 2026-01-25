import { type Message, type PartialMessage, ChannelType, type ReadonlyCollection, MessageType } from "discord.js";
import {
  getDb,
  createMessage,
  updateMessage,
  softDeleteMessage,
  upsertUser,
  createAttachments,
  getThreadById,
  upsertThreadParticipant,
} from "@discord-forum-api/db";
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

function isThreadMessage(message: Message | PartialMessage): boolean {
  if (!message.channel) return false;
  return (
    message.channel.type === ChannelType.PublicThread ||
    message.channel.type === ChannelType.PrivateThread ||
    message.channel.type === ChannelType.AnnouncementThread
  );
}

export async function handleMessageCreate(message: Message): Promise<void> {
  // Only handle thread messages
  if (!isThreadMessage(message)) return;

  const config = getConfig();

  // Skip bot messages if configured to do so
  if (message.author.bot && !config.SYNC_BOT_MESSAGES) return;

  const db = getDb();
  const thread = message.channel;

  if (!thread.isThread()) return;

  logger.debug(`Message created in thread ${thread.name}`, {
    messageId: message.id,
    threadId: thread.id,
  });

  try {
    // Verify thread exists in DB
    const existingThread = await getThreadById(db, thread.id);
    if (!existingThread) {
      logger.warn(`Thread not found in database, skipping message`, {
        threadId: thread.id,
        messageId: message.id,
      });
      return;
    }

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
      channelId: thread.parentId ?? thread.id,
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

    // Track thread participant
    await upsertThreadParticipant(db, {
      threadId: thread.id,
      userId: message.author.id,
      isBot: message.author.bot ?? false,
      lastMessageAt: new Date(),
      incrementMessageCount: true,
    });

    logger.debug(`Stored message in thread ${thread.name}`, { messageId: message.id });
  } catch (error) {
    logger.error(`Failed to store message`, {
      messageId: message.id,
      threadId: thread.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleMessageUpdate(
  _oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage
): Promise<void> {
  // Only handle thread messages
  if (!newMessage.channel || !isThreadMessage(newMessage)) return;

  // Fetch full message if partial
  const message = newMessage.partial ? await newMessage.fetch() : newMessage;

  const db = getDb();

  const thread = message.channel;
  const threadName = thread.isThread() ? thread.name : "unknown";

  logger.debug(`Message updated in thread ${threadName}`, {
    messageId: message.id,
    threadId: thread.id,
  });

  try {
    const updateData: { content: string; contentHtml?: string } = {
      content: message.content,
    };
    if (message.content) {
      updateData.contentHtml = parseDiscordMarkdown(message.content);
    }

    await updateMessage(db, message.id, updateData);

    logger.debug(`Updated message`, { messageId: message.id });
  } catch (error) {
    logger.error(`Failed to update message`, {
      messageId: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleMessageDelete(message: Message | PartialMessage): Promise<void> {
  // We can still process partial deletes since we just need the ID
  const db = getDb();

  logger.debug(`Message deleted`, { messageId: message.id });

  try {
    await softDeleteMessage(db, message.id);
    logger.debug(`Soft deleted message`, { messageId: message.id });
  } catch (error) {
    logger.error(`Failed to soft delete message`, {
      messageId: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleMessageDeleteBulk(
  messages: ReadonlyCollection<string, Message | PartialMessage>
): Promise<void> {
  const db = getDb();

  logger.debug(`Bulk message delete`, { count: messages.size });

  try {
    for (const [_, message] of messages) {
      await softDeleteMessage(db, message.id);
    }
    logger.info(`Soft deleted ${messages.size} messages in bulk`);
  } catch (error) {
    logger.error(`Failed to bulk soft delete messages`, {
      count: messages.size,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
