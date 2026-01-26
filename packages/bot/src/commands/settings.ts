import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { getDb, servers, eq } from "@discolink/db";

export const settingsCommand = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Configure bot settings for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand.setName("view").setDescription("View current settings")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("sync")
        .setDescription("Toggle message syncing")
        .addBooleanOption((option) =>
          option
            .setName("enabled")
            .setDescription("Enable or disable syncing")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("default-consent")
        .setDescription("Set default consent level for new users")
        .addStringOption((option) =>
          option
            .setName("level")
            .setDescription("Default consent level")
            .setRequired(true)
            .addChoices(
              { name: "Public", value: "public" },
              { name: "Anonymous", value: "anonymous" },
              { name: "Private", value: "private" }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const db = getDb();
    const subcommand = interaction.options.getSubcommand();

    // Get current server settings
    const [server] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, interaction.guildId))
      .limit(1);

    if (!server) {
      await interaction.reply({
        content: "Server not found in database. The bot may need to be re-added.",
        ephemeral: true,
      });
      return;
    }

    if (subcommand === "view") {
      const embed = new EmbedBuilder()
        .setTitle("Server Settings")
        .setColor(0x5865f2)
        .addFields(
          { name: "Sync Enabled", value: server.syncEnabled ? "Yes" : "No", inline: true },
          {
            name: "Default Consent",
            value: (server.defaultConsent ?? "public").charAt(0).toUpperCase() +
              (server.defaultConsent ?? "public").slice(1),
            inline: true,
          },
          {
            name: "Last Sync",
            value: server.lastSyncAt
              ? `<t:${Math.floor(server.lastSyncAt.getTime() / 1000)}:R>`
              : "Never",
            inline: true,
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (subcommand === "sync") {
      const enabled = interaction.options.getBoolean("enabled", true);

      await db
        .update(servers)
        .set({ syncEnabled: enabled, updatedAt: new Date() })
        .where(eq(servers.id, interaction.guildId));

      const embed = new EmbedBuilder()
        .setTitle("Settings Updated")
        .setColor(0x00ff00)
        .setDescription(`Message syncing has been **${enabled ? "enabled" : "disabled"}**.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (subcommand === "default-consent") {
      const level = interaction.options.getString("level", true) as
        | "public"
        | "anonymous"
        | "private";

      await db
        .update(servers)
        .set({ defaultConsent: level, updatedAt: new Date() })
        .where(eq(servers.id, interaction.guildId));

      const embed = new EmbedBuilder()
        .setTitle("Settings Updated")
        .setColor(0x00ff00)
        .setDescription(`Default consent level has been set to **${level}**.`)
        .addFields({
          name: "Note",
          value: "This only affects new users. Existing users keep their current consent level.",
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
