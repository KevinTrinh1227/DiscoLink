import { type MessageReaction, type PartialMessageReaction, type User, type PartialUser } from "discord.js";
import {
  getDb,
  upsertUser,
  getPollByMessageId,
  addPollVote,
  removePollVote,
} from "@discolink/db";
import { logger } from "../logger.js";
import { dispatchWebhookEvent } from "../lib/webhook-dispatcher.js";

export async function handlePollVoteAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> {
  const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
  const fullUser = user.partial ? await user.fetch() : user;

  const db = getDb();
  const messageId = fullReaction.message.id;

  try {
    const poll = await getPollByMessageId(db, messageId);
    if (!poll) return;

    // Ensure user exists
    await upsertUser(db, {
      id: fullUser.id,
      username: fullUser.username,
      globalName: fullUser.globalName,
      discriminator: fullUser.discriminator,
      avatar: fullUser.avatar,
      isBot: fullUser.bot,
    });

    // The emoji identifier maps to an answer ID
    const emoji = fullReaction.emoji;
    const emojiKey = emoji.id ?? emoji.name ?? "unknown";

    // Use the reaction count as a rough answer ID mapping
    await addPollVote(db, {
      pollId: poll.id,
      answerId: parseInt(emojiKey) || 1,
      userId: fullUser.id,
    });

    logger.debug(`Poll vote added`, {
      pollId: poll.id,
      userId: fullUser.id,
      messageId,
    });

    if (fullReaction.message.guildId) {
      await dispatchWebhookEvent(fullReaction.message.guildId, "reaction.added", {
        type: "poll_vote",
        pollId: poll.id,
        messageId,
        userId: fullUser.id,
      });
    }
  } catch (error) {
    logger.error(`Failed to handle poll vote add`, {
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handlePollVoteRemove(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> {
  const fullReaction = reaction.partial ? await reaction.fetch() : reaction;

  const db = getDb();
  const messageId = fullReaction.message.id;

  try {
    const poll = await getPollByMessageId(db, messageId);
    if (!poll) return;

    const emoji = fullReaction.emoji;
    const emojiKey = emoji.id ?? emoji.name ?? "unknown";

    await removePollVote(db, poll.id, parseInt(emojiKey) || 1, user.id);

    logger.debug(`Poll vote removed`, {
      pollId: poll.id,
      userId: user.id,
      messageId,
    });
  } catch (error) {
    logger.error(`Failed to handle poll vote remove`, {
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
