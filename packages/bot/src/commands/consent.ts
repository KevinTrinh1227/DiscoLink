import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { getDb, upsertUser, updateUserConsent, getUserById } from "@discord-forum-api/db";

export const consentCommand = {
  data: new SlashCommandBuilder()
    .setName("consent")
    .setDescription("Manage your message visibility preferences")
    .addSubcommand((subcommand) =>
      subcommand.setName("status").setDescription("View your current consent status")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set your consent level")
        .addStringOption((option) =>
          option
            .setName("level")
            .setDescription("Your visibility preference")
            .setRequired(true)
            .addChoices(
              { name: "Public - Messages visible to everyone", value: "public" },
              { name: "Anonymous - Messages visible, author hidden", value: "anonymous" },
              { name: "Private - Messages only visible to server members", value: "private" }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const db = getDb();
    const subcommand = interaction.options.getSubcommand();

    // Ensure user exists in database
    await upsertUser(db, {
      id: interaction.user.id,
      username: interaction.user.username,
      globalName: interaction.user.globalName,
      discriminator: interaction.user.discriminator,
      avatar: interaction.user.avatar,
      isBot: interaction.user.bot,
    });

    if (subcommand === "status") {
      const user = await getUserById(db, interaction.user.id);
      const consent = user?.consentStatus ?? "public";

      const descriptions: Record<string, string> = {
        public: "Your messages are visible to everyone via the API.",
        anonymous: "Your messages are visible, but your identity is hidden.",
        private: "Your messages are only visible to authenticated users who share a server with you.",
      };

      const embed = new EmbedBuilder()
        .setTitle("Consent Status")
        .setColor(consent === "public" ? 0x00ff00 : consent === "anonymous" ? 0xffff00 : 0xff0000)
        .addFields(
          { name: "Current Level", value: consent.charAt(0).toUpperCase() + consent.slice(1), inline: true },
          { name: "Description", value: descriptions[consent] ?? "Unknown" }
        )
        .setFooter({ text: "Use /consent set to change your preference" });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (subcommand === "set") {
      const level = interaction.options.getString("level", true) as "public" | "anonymous" | "private";

      await updateUserConsent(db, interaction.user.id, level);

      const embed = new EmbedBuilder()
        .setTitle("Consent Updated")
        .setColor(0x00ff00)
        .setDescription(`Your consent level has been set to **${level}**.`)
        .addFields({
          name: "What this means",
          value:
            level === "public"
              ? "Your messages and identity will be visible to everyone."
              : level === "anonymous"
                ? "Your messages will be visible, but your identity will be hidden."
                : "Your messages will only be visible to users who share a server with you.",
        });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
