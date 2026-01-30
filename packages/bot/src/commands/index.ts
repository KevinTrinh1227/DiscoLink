import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { syncCommand } from "./sync.js";
import { statusCommand } from "./status.js";
import { settingsCommand } from "./settings.js";
import { consentCommand } from "./consent.js";

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands: Command[] = [
  syncCommand as Command,
  statusCommand as Command,
  settingsCommand as Command,
  consentCommand as Command,
];
