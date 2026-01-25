import { z } from "zod";

const configSchema = z.object({
  // Discord
  DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),

  // Database
  DATABASE_TYPE: z.enum(["sqlite", "turso", "postgres"]).default("sqlite"),
  DATABASE_PATH: z.string().default("./data/discord-forum.db"),
  TURSO_DATABASE_URL: z.string().optional(),
  TURSO_AUTH_TOKEN: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  // Sync options
  SYNC_BOT_MESSAGES: z.coerce.boolean().default(true), // Whether to sync bot messages

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Config = z.infer<typeof configSchema>;

let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    const result = configSchema.safeParse(process.env);
    if (!result.success) {
      const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("\n");
      throw new Error(`Configuration validation failed:\n${errors}`);
    }
    config = result.data;
  }
  return config;
}

export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === "development";
}

export function isProduction(): boolean {
  return getConfig().NODE_ENV === "production";
}
