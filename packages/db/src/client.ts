import { drizzle as drizzleSqlite, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleTurso, type LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle as drizzleD1, type DrizzleD1Database } from "drizzle-orm/d1";
import Database from "better-sqlite3";
import { createClient } from "@libsql/client";
import { z } from "zod";
import * as schema from "./schema.js";

// ============================================================================
// CONFIG SCHEMAS
// ============================================================================
const sqliteConfigSchema = z.object({
  type: z.literal("sqlite"),
  path: z.string().default("./data/discord-forum.db"),
});

const tursoConfigSchema = z.object({
  type: z.literal("turso"),
  url: z.string().url(),
  authToken: z.string(),
});

export const dbConfigSchema = z.discriminatedUnion("type", [
  sqliteConfigSchema,
  tursoConfigSchema,
]);

export type DbConfig = z.infer<typeof dbConfigSchema>;
export type SqliteConfig = z.infer<typeof sqliteConfigSchema>;
export type TursoConfig = z.infer<typeof tursoConfigSchema>;

// ============================================================================
// DATABASE CLIENT TYPE
// Using a simplified type that works across SQLite, Turso, and D1
// ============================================================================
export type DbClient = BetterSQLite3Database<typeof schema> | LibSQLDatabase<typeof schema> | DrizzleD1Database<typeof schema>;

// ============================================================================
// CLIENT FACTORY
// ============================================================================
export function createDbClient(config: DbConfig): DbClient {
  switch (config.type) {
    case "sqlite": {
      const sqlite = new Database(config.path);
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("busy_timeout = 5000");
      sqlite.pragma("synchronous = NORMAL");
      sqlite.pragma("foreign_keys = ON");
      return drizzleSqlite(sqlite, { schema });
    }

    case "turso": {
      const client = createClient({
        url: config.url,
        authToken: config.authToken,
      });
      return drizzleTurso(client, { schema });
    }
  }
}

// ============================================================================
// CONFIG FROM ENVIRONMENT
// ============================================================================
export function getDbConfigFromEnv(): DbConfig {
  const type = process.env["DATABASE_TYPE"] ?? "sqlite";

  switch (type) {
    case "sqlite":
      return {
        type: "sqlite",
        path: process.env["DATABASE_PATH"] ?? "./data/discord-forum.db",
      };

    case "turso": {
      const url = process.env["TURSO_DATABASE_URL"];
      const authToken = process.env["TURSO_AUTH_TOKEN"];
      if (!url || !authToken) {
        throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required for Turso");
      }
      return { type: "turso", url, authToken };
    }

    default:
      // Default to sqlite if unknown
      return {
        type: "sqlite",
        path: process.env["DATABASE_PATH"] ?? "./data/discord-forum.db",
      };
  }
}

// ============================================================================
// DEFAULT CLIENT (initialized lazily)
// ============================================================================
let defaultClient: DbClient | null = null;

export function getDb(): DbClient {
  if (!defaultClient) {
    const config = getDbConfigFromEnv();
    defaultClient = createDbClient(config);
  }
  return defaultClient;
}

export function setDb(client: DbClient): void {
  defaultClient = client;
}

export function resetDb(): void {
  defaultClient = null;
}

// ============================================================================
// D1 CLIENT (for Cloudflare Workers)
// ============================================================================
export function createD1Client(d1: D1Database): DrizzleD1Database<typeof schema> {
  return drizzleD1(d1, { schema });
}
