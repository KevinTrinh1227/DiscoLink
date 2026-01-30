import { type Guild, type GuildMember, type PartialGuildMember } from "discord.js";
import { getDb, upsertServer, markServerInactive, upsertUser } from "@discolink/db";
import { queueInitialSync } from "../sync/initial.js";
import { logger } from "../logger.js";
import { dispatchWebhookEvent } from "../lib/webhook-dispatcher.js";

export async function handleGuildCreate(guild: Guild): Promise<void> {
  const db = getDb();

  logger.info(`Joined guild: ${guild.name}`, { guildId: guild.id });

  try {
    // Create or update server record
    await upsertServer(db, {
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      description: guild.description,
      isActive: true,
    });

    // Queue initial sync
    await queueInitialSync(guild);
  } catch (error) {
    logger.error(`Failed to handle guild create: ${guild.name}`, {
      guildId: guild.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleGuildDelete(guild: Guild): Promise<void> {
  const db = getDb();

  logger.info(`Left guild: ${guild.name}`, { guildId: guild.id });

  try {
    // Mark server as inactive (soft delete)
    await markServerInactive(db, guild.id);
  } catch (error) {
    logger.error(`Failed to handle guild delete: ${guild.name}`, {
      guildId: guild.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleGuildMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
): Promise<void> {
  const db = getDb();

  // Detect Nitro boost status changes
  const wasBoosting = oldMember.premiumSince !== null;
  const isBoosting = newMember.premiumSince !== null;

  if (wasBoosting === isBoosting) return;

  const user = newMember.user;

  try {
    await upsertUser(db, {
      id: user.id,
      username: user.username,
      globalName: user.globalName,
      discriminator: user.discriminator,
      avatar: user.avatar,
      isBot: user.bot,
      premiumType: isBoosting ? 2 : 0,
    });

    logger.info(
      `Member ${isBoosting ? "started" : "stopped"} boosting: ${user.username}`,
      { userId: user.id, guildId: newMember.guild.id }
    );

    await dispatchWebhookEvent(newMember.guild.id, "sync.completed", {
      type: isBoosting ? "member.boost_start" : "member.boost_end",
      userId: user.id,
      username: user.username,
      premiumSince: newMember.premiumSince?.toISOString() ?? null,
    });
  } catch (error) {
    logger.error(`Failed to handle member update`, {
      userId: user.id,
      guildId: newMember.guild.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
