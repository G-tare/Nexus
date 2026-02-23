import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
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
      await interaction.reply({ content: 'No reputation data yet.', ephemeral: true });
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = pageEntries.map((entry, i) => {
      const rank = (page - 1) * perPage + i + 1;
      const medal = rank <= 3 ? medals[rank - 1] : `\`#${rank}\``;
      return `${medal} <@${entry.userId}> — **${entry.reputation}** rep`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('⭐ Reputation Leaderboard')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Page ${page}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
