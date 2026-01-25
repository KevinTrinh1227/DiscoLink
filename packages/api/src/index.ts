import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });

import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { getConfig } from "./config.js";
import { createDbClient, getDbConfigFromEnv, setDb } from "@discord-forum-api/db";

async function main(): Promise<void> {
  console.log("Starting Discord Forum API...");

  // Validate config
  let config;
  try {
    config = getConfig();
  } catch (error) {
    console.error("Configuration error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Initialize database
  try {
    const dbConfig = getDbConfigFromEnv();
    const db = createDbClient(dbConfig);
    setDb(db);
    console.log(`Database connected: ${dbConfig.type}`);
  } catch (error) {
    console.error("Database initialization failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Create app
  const app = createApp();

  // Start server
  serve({
    fetch: app.fetch,
    port: config.API_PORT,
    hostname: config.API_HOST,
  });

  console.log(`API server running on http://${config.API_HOST}:${config.API_PORT}`);

  // Graceful shutdown
  const shutdown = (): void => {
    console.log("Shutting down...");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
