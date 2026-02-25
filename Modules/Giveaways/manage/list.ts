import {  SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getActiveGiveaways } from '../helpers';
import { Colors } from '../../../Shared/src/utils/embed';

export default {
  data: new SlashCommandBuilder()
    .setName('glist')
    .setDescription('List active giveaways'),
  module: 'giveaways',
  permissionPath: 'giveaways.list',
  premiumFeature: 'giveaways.basic',
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Server only.' });
    const active = await getActiveGiveaways(interaction.guildId!);
    if (!active.length) return interaction.reply({ content: 'No active giveaways.' });
    const embed = new EmbedBuilder()
      .setTitle('Active Giveaways')
      .setColor(Colors.Primary)
      .setDescription(active.map((g) =>
        `**#${g.id}** - ${g.prize} (${g.entryCount} entries, ends <t:${Math.floor(g.endsAt.getTime() / 1000)}:R>)`
      ).join('\n'));
    return interaction.reply({ embeds: [embed] });
  },
} as BotCommand;
