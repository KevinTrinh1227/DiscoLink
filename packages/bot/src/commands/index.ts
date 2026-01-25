import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// Add commands here as they are created
export const commands: Command[] = [
  // Placeholder - add actual commands when implemented
];
