import { type Guild } from "discord.js";
import { getDb, upsertServer, markServerInactive } from "@discordlink/db";
import { queueInitialSync } from "../sync/initial.js";
import { logger } from "../logger.js";

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
