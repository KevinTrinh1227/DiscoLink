import { defineConfig } from "drizzle-kit";

const databaseType = process.env["DATABASE_TYPE"] ?? "sqlite";

function getConfig() {
  switch (databaseType) {
    case "sqlite":
      return {
        dialect: "sqlite" as const,
        dbCredentials: {
          url: process.env["DATABASE_PATH"] ?? "./data/discord-forum.db",
        },
      };

    case "turso":
      return {
        dialect: "turso" as const,
        dbCredentials: {
          url: process.env["TURSO_DATABASE_URL"]!,
          authToken: process.env["TURSO_AUTH_TOKEN"],
        },
      };

    case "postgres":
      return {
        dialect: "postgresql" as const,
        dbCredentials: {
          url: process.env["DATABASE_URL"]!,
        },
      };

    default:
      throw new Error(`Unknown database type: ${databaseType}`);
  }
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  ...getConfig(),
});
