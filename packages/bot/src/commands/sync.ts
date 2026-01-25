import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { queueInitialSync, runBackfill } from "../sync/initial.js";
import { logger } from "../logger.js";

export const syncCommand = {
  data: new SlashCommandBuilder()
    .setName("sync")
    .setDescription("Sync server content to the database")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand.setName("full").setDescription("Run a full sync of all threads and messages")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("backfill")
        .setDescription("Backfill historical messages")
        .addIntegerOption((option) =>
          option
            .setName("days")
            .setDescription("Number of days to backfill (default: 30)")
            .setMinValue(1)
            .setMaxValue(365)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "full") {
      await interaction.deferReply();

      const embed = new EmbedBuilder()
        .setTitle("Sync Started")
        .setColor(0xffff00)
        .setDescription("Starting full sync of all threads and messages...")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      try {
        await queueInitialSync(interaction.guild);

        const successEmbed = new EmbedBuilder()
          .setTitle("Sync Complete")
          .setColor(0x00ff00)
          .setDescription("Successfully synced all threads and messages.")
          .setTimestamp();

        await interaction.followUp({ embeds: [successEmbed] });
      } catch (error) {
        logger.error("Full sync failed", {
          guildId: interaction.guildId,
          error: error instanceof Error ? error.message : String(error),
        });

        const errorEmbed = new EmbedBuilder()
          .setTitle("Sync Failed")
          .setColor(0xff0000)
          .setDescription("An error occurred during sync. Check the logs for details.")
          .setTimestamp();

        await interaction.followUp({ embeds: [errorEmbed] });
      }
    } else if (subcommand === "backfill") {
      const days = interaction.options.getInteger("days") ?? 30;

      await interaction.deferReply();

      const embed = new EmbedBuilder()
        .setTitle("Backfill Started")
        .setColor(0xffff00)
        .setDescription(`Starting backfill of messages from the last ${days} days...`)
        .addFields({ name: "Note", value: "This may take a while for large servers." })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      try {
        const result = await runBackfill(interaction.guild, days);

        const successEmbed = new EmbedBuilder()
          .setTitle("Backfill Complete")
          .setColor(0x00ff00)
          .setDescription(`Successfully backfilled ${result.messagesProcessed} messages.`)
          .addFields(
            { name: "Threads Processed", value: result.threadsProcessed.toString(), inline: true },
            { name: "Messages Processed", value: result.messagesProcessed.toString(), inline: true }
          )
          .setTimestamp();

        await interaction.followUp({ embeds: [successEmbed] });
      } catch (error) {
        logger.error("Backfill failed", {
          guildId: interaction.guildId,
          error: error instanceof Error ? error.message : String(error),
        });

        const errorEmbed = new EmbedBuilder()
          .setTitle("Backfill Failed")
          .setColor(0xff0000)
          .setDescription("An error occurred during backfill. Check the logs for details.")
          .setTimestamp();

        await interaction.followUp({ embeds: [errorEmbed] });
      }
    }
  },
};
