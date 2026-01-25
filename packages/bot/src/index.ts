import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });

import { createClient, loginClient, destroyClient } from "./client.js";
import { registerEvents } from "./events/index.js";
import { createDbClient, getDbConfigFromEnv, setDb } from "@discord-forum-api/db";
import { logger } from "./logger.js";
import { getConfig } from "./config.js";

async function main(): Promise<void> {
  logger.info("Starting Discord Forum API Bot...");

  // Validate config
  try {
    getConfig();
  } catch (error) {
    logger.error("Configuration error", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  // Initialize database
  try {
    const dbConfig = getDbConfigFromEnv();
    const db = createDbClient(dbConfig);
    setDb(db);
    logger.info(`Database connected: ${dbConfig.type}`);
  } catch (error) {
    logger.error("Database initialization failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  // Create Discord client
  const client = createClient();

  // Register event handlers
  registerEvents(client);

  // Login to Discord
  try {
    await loginClient();
  } catch (error) {
    logger.error("Discord login failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  // Graceful shutdown handlers
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down...`);
    await destroyClient();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { error: error.message });
    process.exit(1);
  });
}

main().catch((error) => {
  logger.error("Fatal error", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
