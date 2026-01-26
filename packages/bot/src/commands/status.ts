import { SlashCommandBuilder, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getDb, servers, threads, messages, eq, and, isNull } from "@discordlink/db";
import { getClient } from "../client.js";

export const statusCommand = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("View bot status and statistics"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const db = getDb();
    const client = getClient();

    await interaction.deferReply();

    // Get overall stats
    const guildCount = client.guilds.cache.size;

    // Get server-specific stats if in a guild
    let serverStats = null;
    if (interaction.guildId) {
      const serverResult = await db
        .select()
        .from(servers)
        .where(eq(servers.id, interaction.guildId))
        .limit(1);

      const server = serverResult[0];

      if (server) {
        const threadResult = await db
          .select()
          .from(threads)
          .where(and(eq(threads.serverId, interaction.guildId), isNull(threads.deletedAt)));

        const messageResult = await db
          .select()
          .from(messages)
          .where(and(eq(messages.serverId, interaction.guildId), isNull(messages.deletedAt)));

        serverStats = {
          name: server.name,
          threads: threadResult.length,
          messages: messageResult.length,
          syncEnabled: server.syncEnabled,
          lastSync: server.lastSyncAt,
        };
      }
    }

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const embed = new EmbedBuilder()
      .setTitle("DiscordLink - Bot Status")
      .setColor(0x5865f2)
      .addFields(
        { name: "Uptime", value: `${hours}h ${minutes}m ${seconds}s`, inline: true },
        { name: "Servers", value: guildCount.toString(), inline: true },
        { name: "Ping", value: `${client.ws.ping}ms`, inline: true }
      )
      .setTimestamp();

    if (serverStats) {
      embed.addFields(
        { name: "\u200B", value: "**Server Statistics**" },
        { name: "Threads Synced", value: serverStats.threads.toString(), inline: true },
        { name: "Messages Synced", value: serverStats.messages.toString(), inline: true },
        {
          name: "Sync Status",
          value: serverStats.syncEnabled ? "Enabled" : "Disabled",
          inline: true,
        }
      );

      if (serverStats.lastSync) {
        embed.addFields({
          name: "Last Sync",
          value: `<t:${Math.floor(serverStats.lastSync.getTime() / 1000)}:R>`,
          inline: true,
        });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
