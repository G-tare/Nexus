import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { paginatedContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getRepLeaderboard } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('repleaderboard')
    .setDescription('View the reputation leaderboard')
    .addIntegerOption(opt =>
      opt.setName('page')
        .setDescription('Page number')
        .setMinValue(1)) as SlashCommandBuilder,

  module: 'reputation',
  permissionPath: 'reputation.repleaderboard',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const page = interaction.options.getInteger('page') || 1;
    const perPage = 10;

    const entries = await getRepLeaderboard(guild.id, perPage * page);
    const pageEntries = entries.slice((page - 1) * perPage, page * perPage);

    if (pageEntries.length === 0) {
      await interaction.reply({ content: 'No reputation data yet.', flags: MessageFlags.Ephemeral });
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const allEntries = await getRepLeaderboard(guild.id, 100);
    const items = allEntries.map((entry, i) => {
      const rank = i + 1;
      const medal = rank <= 3 ? medals[rank - 1] : `\`#${rank}\``;
      return `${medal} <@${entry.userId}> — **${entry.reputation}** rep`;
    });

    const { container } = paginatedContainer(items, page - 1, perPage, '⭐ Reputation Leaderboard', 0xF1C40F);
    await interaction.reply(v2Payload([container]));
  },
};

export default command;
