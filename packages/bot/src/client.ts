import { Client, GatewayIntentBits, Partials } from "discord.js";
import { getConfig } from "./config.js";
import { logger } from "./logger.js";

let client: Client | null = null;

export function createClient(): Client {
  if (client) {
    return client;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.Reaction,
      Partials.ThreadMember,
    ],
  });

  return client;
}

export function getClient(): Client {
  if (!client) {
    throw new Error("Discord client not initialized. Call createClient() first.");
  }
  return client;
}

export async function loginClient(): Promise<void> {
  const discordClient = getClient();
  const config = getConfig();

  logger.info("Logging in to Discord...");

  await discordClient.login(config.DISCORD_BOT_TOKEN);
}

export async function destroyClient(): Promise<void> {
  if (client) {
    await client.destroy();
    client = null;
    logger.info("Discord client destroyed");
  }
}
