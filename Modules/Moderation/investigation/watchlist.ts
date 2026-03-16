import {  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel, MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successContainer, errorContainer, infoContainer, addFields, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { cache } from '../../../Shared/src/cache/cacheManager';
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
    await interaction.deferReply({});

    const guild = interaction.guild!;
    await ensureGuild(guild);

    const action = interaction.options.getString('action', true) as 'add' | 'remove' | 'view';
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const watchlistSetKey = `watchlist:${guild.id}`;

    try {
      if (action === 'add') {
        if (!targetUser) {
          await interaction.editReply(v2Payload([
            errorContainer('User is required for add action')
          ]));
          return;
        }

        if (!reason) {
          await interaction.editReply(v2Payload([
            errorContainer('Reason is required for add action')
          ]));
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

        cache.sadd(watchlistSetKey, JSON.stringify(entry));

        const container = successContainer(`${targetUser.tag} added to watchlist`);
        addFields(container, [{ name: 'Reason', value: reason }]);

        await interaction.editReply(v2Payload([container]));

        // Update watchlist channel if configured
        await updateWatchlistChannel(guild.id, guild);
      } else if (action === 'remove') {
        if (!targetUser) {
          await interaction.editReply(v2Payload([
            errorContainer('User is required for remove action')
          ]));
          return;
        }

        // Get all entries and remove matching user
        const entries = cache.smembers(watchlistSetKey);
        let found = false;

        for (const entry of entries) {
          const parsed: WatchlistEntry = JSON.parse(entry);
          if (parsed.userId === targetUser.id) {
            cache.srem(watchlistSetKey, entry);
            found = true;
            break;
          }
        }

        if (!found) {
          await interaction.editReply(v2Payload([
            errorContainer('User is not on the watchlist')
          ]));
          return;
        }

        const container = successContainer(`${targetUser.tag} removed from watchlist`);
        await interaction.editReply(v2Payload([container]));

        // Update watchlist channel if configured
        await updateWatchlistChannel(guild.id, guild);
      } else if (action === 'view') {
        const entries = cache.smembers(watchlistSetKey);

        if (entries.length === 0) {
          await interaction.editReply(v2Payload([
            errorContainer('The watchlist is empty')
          ]));
          return;
        }

        const container = infoContainer(`Watchlist for ${guild.name}`, `Total entries: ${entries.length}`);

        const parsedEntries: WatchlistEntry[] = entries.map(e => JSON.parse(e));

        const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
        for (const entry of parsedEntries.slice(0, 20)) {
          const user = await guild.client.users.fetch(entry.userId).catch(() => null);
          const addedByUser = await guild.client.users.fetch(entry.addedBy).catch(() => null);

          fields.push({
            name: user?.tag || `Unknown (${entry.userId})`,
            value: `Reason: ${entry.reason}\nAdded by: ${addedByUser?.tag || 'Unknown'}\nAdded: <t:${Math.floor(entry.addedAt / 1000)}:R>`
          });
        }

        addFields(container, fields);

        if (entries.length > 20) {
          addFooter(container, `Showing 20 of ${entries.length} entries`);
        }

        await interaction.editReply(v2Payload([container]));
      }
    } catch (error) {
      console.error('Error in watchlist command:', error);
      await interaction.editReply(v2Payload([
        errorContainer('An error occurred while managing the watchlist')
      ]));
    }
  }
} as BotCommand;

async function updateWatchlistChannel(guildId: string, guild: any): Promise<void> {
  try {
    const modConfig = await getModConfig(guildId);
    if (!modConfig?.watchlistChannelId) return;

    const channel = await guild.client.channels.fetch(modConfig.watchlistChannelId).catch(() => null) as TextChannel | null;
    if (!channel || !channel.isTextBased()) return;

    const watchlistSetKey = `watchlist:${guildId}`;
    const entries = cache.smembers(watchlistSetKey);

    if (entries.length === 0) {
      // Delete message if watchlist is empty
      const messages = await channel.messages.fetch({ limit: 10 });
      const botMessage = messages.find(m => m.author.id === guild.client.user.id);
      if (botMessage) await botMessage.delete().catch(() => {});
      return;
    }

    const container = infoContainer('Server Watchlist', `Active entries: ${entries.length}`);

    const parsedEntries: WatchlistEntry[] = entries.map(e => JSON.parse(e));

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
    for (const entry of parsedEntries.slice(0, 20)) {
      const user = await guild.client.users.fetch(entry.userId).catch(() => null);
      fields.push({
        name: user?.tag || `Unknown (${entry.userId})`,
        value: `${entry.reason}`
      });
    }

    addFields(container, fields);

    if (entries.length > 20) {
      addFooter(container, `Showing 20 of ${entries.length} entries`);
    }

    // Find and update or create message
    const messages = await channel.messages.fetch({ limit: 10 });
    const botMessage = messages.find(m => m.author.id === guild.client.user.id);

    if (botMessage) {
      await botMessage.edit(v2Payload([container])).catch(() => {});
    } else {
      await (channel as any).send(v2Payload([container])).catch(() => {});
    }
  } catch (error) {
    console.error('Error updating watchlist channel:', error);
  }
}
