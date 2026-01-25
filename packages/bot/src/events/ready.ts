import { type Client, REST, Routes } from "discord.js";
import { getConfig } from "../config.js";
import { logger } from "../logger.js";
import { commands } from "../commands/index.js";
import { handleGuildCreate } from "./guild.js";

export async function handleReady(client: Client<true>): Promise<void> {
  logger.info(`Logged in as ${client.user.tag}`);
  logger.info(`Serving ${client.guilds.cache.size} guilds`);

  // Register slash commands
  await registerCommands();

  // Sync existing guilds on startup
  await syncExistingGuilds(client);
}

async function syncExistingGuilds(client: Client<true>): Promise<void> {
  logger.info("Syncing existing guilds...");

  for (const [_, guild] of client.guilds.cache) {
    try {
      logger.info(`Syncing guild: ${guild.name}`, { guildId: guild.id });
      await handleGuildCreate(guild);
    } catch (error) {
      logger.error(`Failed to sync guild: ${guild.name}`, {
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Finished syncing existing guilds");
}

async function registerCommands(): Promise<void> {
  const config = getConfig();
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_BOT_TOKEN);

  const commandData = commands.map((cmd) => cmd.data.toJSON());

  try {
    logger.info(`Registering ${commandData.length} slash commands...`);

    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {
      body: commandData,
    });

    logger.info("Successfully registered slash commands");
  } catch (error) {
    logger.error("Failed to register slash commands", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
