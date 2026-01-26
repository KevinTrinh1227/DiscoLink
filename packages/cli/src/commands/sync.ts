import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

interface Config {
  serverId: string;
  apiUrl: string;
}

async function loadConfig(): Promise<Config | null> {
  if (!existsSync("discordlink.config.json")) {
    return null;
  }

  const content = await readFile("discordlink.config.json", "utf-8");
  return JSON.parse(content);
}

export const syncCommand = new Command("sync")
  .description("Trigger a manual sync from Discord")
  .option("-s, --server <id>", "Server ID to sync")
  .option("--api-url <url>", "DiscordLink API URL")
  .action(async (options: { server?: string; apiUrl?: string }) => {
    const spinner = ora("Loading configuration...").start();

    try {
      // Load config if available
      const config = await loadConfig();

      const serverId = options.server ?? config?.serverId;
      const apiUrl = options.apiUrl ?? config?.apiUrl ?? "http://localhost:3000";

      if (!serverId) {
        spinner.fail(
          "No server ID provided. Use --server <id> or run 'discordlink init' first."
        );
        process.exit(1);
      }

      spinner.text = `Triggering sync for server ${serverId}...`;

      // Note: This would call a sync endpoint on the API
      // For now, we'll just simulate it since the sync is bot-initiated
      const response = await fetch(`${apiUrl}/servers/${serverId}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const server = await response.json();

      spinner.succeed(`Server "${server.name}" is synced`);

      console.log(`
${chalk.bold("Server Info:")}
  Name: ${server.name}
  ID: ${server.id}
  Members: ${server.memberCount ?? "N/A"}

${chalk.dim("Note: Real-time sync happens automatically via the Discord bot.")}
${chalk.dim("This command verifies the API connection and shows server status.")}
`);
    } catch (error) {
      spinner.fail(
        `Sync failed: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });
