import { type AnyThreadChannel, ChannelType } from "discord.js";
import {
  getDb,
  createThread,
  updateThread,
  softDeleteThread,
  upsertUser,
  setThreadTags,
  upsertTag,
} from "@discordlink/db";
import { logger } from "../logger.js";
import { dispatchWebhookEvent } from "../lib/webhook-dispatcher.js";

function isForumThread(thread: AnyThreadChannel): boolean {
  return (
    thread.parent?.type === ChannelType.GuildForum ||
    thread.parent?.type === ChannelType.GuildMedia
  );
}

export async function handleThreadCreate(
  thread: AnyThreadChannel,
  newlyCreated: boolean
): Promise<void> {
  if (!newlyCreated) return; // Skip if thread was just unarchived

  const db = getDb();

  logger.debug(`Thread created: ${thread.name}`, {
    threadId: thread.id,
    channelId: thread.parentId,
    guildId: thread.guildId,
  });

  try {
    // Ensure author exists
    if (thread.ownerId) {
      const owner = await thread.guild?.members.fetch(thread.ownerId).catch(() => null);
      if (owner) {
        await upsertUser(db, {
          id: owner.id,
          username: owner.user.username,
          globalName: owner.user.globalName,
          discriminator: owner.user.discriminator,
          avatar: owner.user.avatar,
          isBot: owner.user.bot,
        });
      }
    }

    // Create thread record
    const newThread = await createThread(db, {
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

    // Handle forum tags if applicable
    if (isForumThread(thread) && thread.appliedTags.length > 0) {
      const parent = thread.parent;
      if (parent && "availableTags" in parent) {
        // Sync available tags
        for (const tag of parent.availableTags) {
          await upsertTag(db, {
            id: tag.id,
            channelId: parent.id,
            name: tag.name,
            emoji: tag.emoji?.name ?? tag.emoji?.id ?? null,
            isModerated: tag.moderated,
          });
        }

        // Associate tags with thread
        await setThreadTags(db, thread.id, thread.appliedTags);
      }
    }

    logger.info(`Stored thread: ${thread.name}`, { threadId: thread.id, slug: newThread?.slug });

    // Dispatch webhook event
    if (thread.guildId) {
      await dispatchWebhookEvent(thread.guildId, "thread.created", {
        id: thread.id,
        title: thread.name,
        channelId: thread.parentId,
        authorId: thread.ownerId,
        slug: newThread?.slug,
      });
    }
  } catch (error) {
    logger.error(`Failed to store thread ${thread.name}`, {
      threadId: thread.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleThreadUpdate(
  _oldThread: AnyThreadChannel,
  newThread: AnyThreadChannel
): Promise<void> {
  const db = getDb();

  logger.debug(`Thread updated: ${newThread.name}`, {
    threadId: newThread.id,
    archived: newThread.archived,
    locked: newThread.locked,
  });

  try {
    await updateThread(db, newThread.id, {
      title: newThread.name,
      isArchived: newThread.archived ?? false,
      isLocked: newThread.locked ?? false,
      archivedAt: newThread.archived ? new Date() : undefined,
    });

    // Update tags if forum thread
    if (isForumThread(newThread)) {
      await setThreadTags(db, newThread.id, newThread.appliedTags);
    }

    logger.debug(`Updated thread: ${newThread.name}`);

    // Dispatch webhook event
    if (newThread.guildId) {
      const eventType = newThread.archived ? "thread.resolved" : "thread.updated";
      await dispatchWebhookEvent(newThread.guildId, eventType, {
        id: newThread.id,
        title: newThread.name,
        channelId: newThread.parentId,
        isArchived: newThread.archived,
        isLocked: newThread.locked,
      });
    }
  } catch (error) {
    logger.error(`Failed to update thread ${newThread.name}`, {
      threadId: newThread.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleThreadDelete(thread: AnyThreadChannel): Promise<void> {
  const db = getDb();

  logger.debug(`Thread deleted: ${thread.name}`, { threadId: thread.id });

  try {
    await softDeleteThread(db, thread.id);
    logger.info(`Soft deleted thread: ${thread.name}`);

    // Dispatch webhook event
    if (thread.guildId) {
      await dispatchWebhookEvent(thread.guildId, "thread.deleted", {
        id: thread.id,
        title: thread.name,
        channelId: thread.parentId,
      });
    }
  } catch (error) {
    logger.error(`Failed to soft delete thread ${thread.name}`, {
      threadId: thread.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
