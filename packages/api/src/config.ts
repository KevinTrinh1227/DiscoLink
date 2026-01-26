import { z } from "zod";

const configSchema = z.object({
  // API Server
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default("0.0.0.0"),

  // Database
  DATABASE_TYPE: z.enum(["sqlite", "turso", "postgres"]).default("sqlite"),
  DATABASE_PATH: z.string().default("./data/discord-forum.db"),
  TURSO_DATABASE_URL: z.string().optional(),
  TURSO_AUTH_TOKEN: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  // Discord OAuth (optional - only needed for protected endpoints)
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  OAUTH_CALLBACK_URL: z.string().url().default("http://localhost:3000/auth/discord/callback"),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Proxy Settings (for rate limiting IP detection)
  // Set to true only if running behind a trusted reverse proxy (nginx, Cloudflare, etc.)
  TRUSTED_PROXY: z.coerce.boolean().default(false),

  // CORS
  CORS_ORIGINS: z.string().default("*"),

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
