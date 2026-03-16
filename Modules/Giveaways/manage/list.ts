import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getActiveGiveaways } from '../helpers';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

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

    const container = moduleContainer('giveaways');
    addText(container, '### Active Giveaways');
    const giveawayLines = active.map((g) =>
      `**#${g.id}** - ${g.prize} (${g.entryCount} entries, ends <t:${Math.floor(g.endsAt.getTime() / 1000)}:R>)`
    ).join('\n');
    addText(container, giveawayLines);

    return interaction.reply(v2Payload([container]));
  },
} as BotCommand;
