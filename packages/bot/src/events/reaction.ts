import { type MessageReaction, type PartialMessageReaction, type User, type PartialUser, ChannelType } from "discord.js";
import {
  getDb,
  upsertReaction,
  getMessageById,
  getReactionByMessageAndEmoji,
  upsertReactionUser,
  deleteReactionUser,
  upsertUser,
  reactions,
  eq,
} from "@discord-forum-api/db";
import { logger } from "../logger.js";

function isThreadReaction(reaction: MessageReaction | PartialMessageReaction): boolean {
  return (
    reaction.message.channel.type === ChannelType.PublicThread ||
    reaction.message.channel.type === ChannelType.PrivateThread ||
    reaction.message.channel.type === ChannelType.AnnouncementThread
  );
}

export async function handleReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> {
  if (!isThreadReaction(reaction)) return;

  // Fetch full reaction if partial
  const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
  const fullUser = user.partial ? await user.fetch() : user;

  const db = getDb();
  const emoji = fullReaction.emoji;

  logger.debug(`Reaction added`, {
    messageId: fullReaction.message.id,
    emoji: emoji.name ?? emoji.id,
    userId: fullUser.id,
  });

  try {
    // Verify message exists in DB
    const existingMessage = await getMessageById(db, fullReaction.message.id);
    if (!existingMessage) {
      logger.debug(`Message not found in database, skipping reaction`, {
        messageId: fullReaction.message.id,
      });
      return;
    }

    // Build emoji URL for custom emojis
    const emojiUrl = emoji.id
      ? `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}`
      : null;

    // Upsert reaction with animated emoji support
    const reactionRecord = await upsertReaction(db, {
      messageId: fullReaction.message.id,
      emoji: emoji.id ?? emoji.name ?? "unknown",
      emojiName: emoji.name,
      isCustom: !!emoji.id,
      isAnimated: emoji.animated ?? false,
      emojiUrl,
      guildId: emoji.id ? (fullReaction.message.guild?.id ?? null) : null,
      count: fullReaction.count,
    });

    // Ensure user exists
    await upsertUser(db, {
      id: fullUser.id,
      username: fullUser.username,
      globalName: fullUser.globalName,
      discriminator: fullUser.discriminator,
      avatar: fullUser.avatar,
      isBot: fullUser.bot,
    });

    // Track individual reaction user
    if (reactionRecord.id) {
      await upsertReactionUser(db, {
        reactionId: reactionRecord.id,
        userId: fullUser.id,
        reactedAt: new Date(),
      });
    }

    logger.debug(`Stored reaction`, {
      messageId: fullReaction.message.id,
      count: fullReaction.count,
      userId: fullUser.id,
    });
  } catch (error) {
    logger.error(`Failed to store reaction`, {
      messageId: fullReaction.message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleReactionRemove(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> {
  if (!isThreadReaction(reaction)) return;

  // Fetch full reaction if partial
  const fullReaction = reaction.partial ? await reaction.fetch() : reaction;

  const db = getDb();
  const emoji = fullReaction.emoji;

  logger.debug(`Reaction removed`, {
    messageId: fullReaction.message.id,
    emoji: emoji.name ?? emoji.id,
    userId: user.id,
  });

  try {
    const emojiKey = emoji.id ?? emoji.name ?? "unknown";

    // Build emoji URL for custom emojis
    const emojiUrl = emoji.id
      ? `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}`
      : null;

    // Update count (upsert handles setting count to new value)
    await upsertReaction(db, {
      messageId: fullReaction.message.id,
      emoji: emojiKey,
      emojiName: emoji.name,
      isCustom: !!emoji.id,
      isAnimated: emoji.animated ?? false,
      emojiUrl,
      guildId: emoji.id ? (fullReaction.message.guild?.id ?? null) : null,
      count: fullReaction.count,
    });

    // Remove individual reaction user tracking
    const existingReaction = await getReactionByMessageAndEmoji(db, fullReaction.message.id, emojiKey);
    if (existingReaction?.id) {
      await deleteReactionUser(db, existingReaction.id, user.id);
    }

    logger.debug(`Updated reaction count`, {
      messageId: fullReaction.message.id,
      count: fullReaction.count,
      userId: user.id,
    });
  } catch (error) {
    logger.error(`Failed to update reaction`, {
      messageId: fullReaction.message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleReactionRemoveAll(
  message: { id: string; channel: { type: number } }
): Promise<void> {
  const isThread =
    message.channel.type === ChannelType.PublicThread ||
    message.channel.type === ChannelType.PrivateThread ||
    message.channel.type === ChannelType.AnnouncementThread;

  if (!isThread) return;

  const db = getDb();

  logger.debug(`All reactions removed from message`, {
    messageId: message.id,
  });

  try {
    // Get all reactions for this message and set count to 0
    const existingReactions = await db
      .select()
      .from(reactions)
      .where(eq(reactions.messageId, message.id));

    for (const reaction of existingReactions) {
      await upsertReaction(db, {
        messageId: message.id,
        emoji: reaction.emoji,
        emojiName: reaction.emojiName,
        isCustom: reaction.isCustom,
        isAnimated: reaction.isAnimated ?? false,
        emojiUrl: reaction.emojiUrl,
        guildId: reaction.guildId,
        count: 0,
      });
    }

    logger.debug(`Cleared all reactions from message`, {
      messageId: message.id,
    });
  } catch (error) {
    logger.error(`Failed to clear reactions`, {
      messageId: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
