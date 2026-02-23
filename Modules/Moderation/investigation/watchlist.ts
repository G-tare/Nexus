import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, TextChannel } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getRedis } from '../../../Shared/src/database/connection';
import { ensureGuild, ensureGuildMember, getModConfig } from '../helpers';

interface WatchlistEntry {
  userId: string;
  reason: string;
  addedBy: string;
  addedAt: number;
}

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.watchlist',
  data: new SlashCommandBuilder()
    .setName('watchlist')
    .setDescription('Manage the server watchlist')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Action to perform')
        .setRequired(true)
        .addChoices(
          { name: 'Add', value: 'add' },
          { name: 'Remove', value: 'remove' },
          { name: 'View', value: 'view' }
        )
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to add or remove (required for add/remove)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for watchlist (required for add)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    await ensureGuild(guild);

    const action = interaction.options.getString('action', true) as 'add' | 'remove' | 'view';
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const redis = await getRedis();
    const watchlistSetKey = `watchlist:${guild.id}`;

    try {
      if (action === 'add') {
        if (!targetUser) {
          await interaction.editReply({
            embeds: [errorEmbed('User is required for add action')]
          });
          return;
        }

        if (!reason) {
          await interaction.editReply({
            embeds: [errorEmbed('Reason is required for add action')]
          });
          return;
        }

        await ensureGuildMember(guild.id, targetUser.id);
      const targetMember = await guild.members.fetch(targetUser.id);
        if (!targetMember) return;

        const entry: WatchlistEntry = {
          userId: targetUser.id,
          reason: reason,
          addedBy: interaction.user.id,
          addedAt: Date.now()
        };

        await redis.sadd(watchlistSetKey, JSON.stringify(entry));

        const embed = successEmbed(`${targetUser.tag} added to watchlist`);
        embed.addFields({ name: 'Reason', value: reason });

        await interaction.editReply({ embeds: [embed] });

        // Update watchlist channel if configured
        await updateWatchlistChannel(guild.id, guild);
      } else if (action === 'remove') {
        if (!targetUser) {
          await interaction.editReply({
            embeds: [errorEmbed('User is required for remove action')]
          });
          return;
        }

        // Get all entries and remove matching user
        const entries = await redis.smembers(watchlistSetKey);
        let found = false;

        for (const entry of entries) {
          const parsed: WatchlistEntry = JSON.parse(entry);
          if (parsed.userId === targetUser.id) {
            await redis.srem(watchlistSetKey, entry);
            found = true;
            break;
          }
        }

        if (!found) {
          await interaction.editReply({
            embeds: [errorEmbed('User is not on the watchlist')]
          });
          return;
        }

        const embed = successEmbed(`${targetUser.tag} removed from watchlist`);
        await interaction.editReply({ embeds: [embed] });

        // Update watchlist channel if configured
        await updateWatchlistChannel(guild.id, guild);
      } else if (action === 'view') {
        const entries = await redis.smembers(watchlistSetKey);

        if (entries.length === 0) {
          await interaction.editReply({
            embeds: [errorEmbed('The watchlist is empty')]
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(Colors.Info)
          .setTitle(`Watchlist for ${guild.name}`)
          .setDescription(`Total entries: ${entries.length}`);

        const parsedEntries: WatchlistEntry[] = entries.map(e => JSON.parse(e));

        for (const entry of parsedEntries.slice(0, 20)) {
          const user = await guild.client.users.fetch(entry.userId).catch(() => null);
          const addedByUser = await guild.client.users.fetch(entry.addedBy).catch(() => null);

          embed.addFields({
            name: user?.tag || `Unknown (${entry.userId})`,
            value: `Reason: ${entry.reason}\nAdded by: ${addedByUser?.tag || 'Unknown'}\nAdded: <t:${Math.floor(entry.addedAt / 1000)}:R>`
          });
        }

        if (entries.length > 20) {
          embed.setFooter({ text: `Showing 20 of ${entries.length} entries` });
        }

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error in watchlist command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while managing the watchlist')]
      });
    }
  }
} as BotCommand;

async function updateWatchlistChannel(guildId: string, guild: any): Promise<void> {
  try {
    const modConfig = await getModConfig(guildId);
    if (!modConfig?.watchlistChannelId) return;

    const channel = await guild.client.channels.fetch(modConfig.watchlistChannelId).catch(() => null) as TextChannel | null;
    if (!channel || !channel.isTextBased()) return;

    const redis = await getRedis();
    const watchlistSetKey = `watchlist:${guildId}`;
    const entries = await redis.smembers(watchlistSetKey);

    if (entries.length === 0) {
      // Delete message if watchlist is empty
      const messages = await channel.messages.fetch({ limit: 10 });
      const botMessage = messages.find(m => m.author.id === guild.client.user.id);
      if (botMessage) await botMessage.delete().catch(() => {});
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Warning)
      .setTitle('Server Watchlist')
      .setDescription(`Active entries: ${entries.length}`)
      .setTimestamp();

    const parsedEntries: WatchlistEntry[] = entries.map(e => JSON.parse(e));

    for (const entry of parsedEntries.slice(0, 20)) {
      const user = await guild.client.users.fetch(entry.userId).catch(() => null);
      embed.addFields({
        name: user?.tag || `Unknown (${entry.userId})`,
        value: `${entry.reason}`
      });
    }

    if (entries.length > 20) {
      embed.setFooter({ text: `Showing 20 of ${entries.length} entries` });
    }

    // Find and update or create message
    const messages = await channel.messages.fetch({ limit: 10 });
    const botMessage = messages.find(m => m.author.id === guild.client.user.id);

    if (botMessage) {
      await botMessage.edit({ embeds: [embed] }).catch(() => {});
    } else {
      await (channel as any).send({ embeds: [embed] }).catch(() => {});
    }
  } catch (error) {
    console.error('Error updating watchlist channel:', error);
  }
}
