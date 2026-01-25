import { type Interaction, InteractionType } from "discord.js";
import { commands } from "../commands/index.js";
import { logger } from "../logger.js";

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  // Only handle slash commands
  if (interaction.type !== InteractionType.ApplicationCommand) return;
  if (!interaction.isChatInputCommand()) return;

  const command = commands.find((cmd) => cmd.data.name === interaction.commandName);

  if (!command) {
    logger.warn(`Unknown command: ${interaction.commandName}`);
    await interaction.reply({
      content: "Unknown command.",
      ephemeral: true,
    });
    return;
  }

  logger.debug(`Executing command: ${interaction.commandName}`, {
    userId: interaction.user.id,
    guildId: interaction.guildId,
  });

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Command execution failed: ${interaction.commandName}`, {
      error: error instanceof Error ? error.message : String(error),
    });

    const errorMessage = "There was an error executing this command.";

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
