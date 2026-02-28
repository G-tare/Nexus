import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getUserRep, getUserRank, getRepHistory, formatDelta, relativeTimestamp } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rep')
    .setDescription('View a user\'s reputation')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to check (defaults to yourself)')) as SlashCommandBuilder,

  module: 'reputation',
  permissionPath: 'reputation.rep',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const target = interaction.options.getUser('user') || interaction.user;

    const rep = await getUserRep(guild.id, target.id);
    const rank = await getUserRank(guild.id, target.id);
    const history = await getRepHistory(guild.id, target.id, 5);

    const recentChanges = history.length > 0
      ? history.map(h => {
          const who = h.givenBy === 'system' ? '🤖 System' : `<@${h.givenBy}>`;
          return `${formatDelta(h.delta)} by ${who} ${relativeTimestamp(h.createdAt)}${h.reason ? ` — ${h.reason}` : ''}`;
        }).join('\n')
      : 'No recent changes';

    const embed = new EmbedBuilder()
      .setColor(rep >= 0 ? 0x2ECC71 : 0xE74C3C)
      .setTitle(`⭐ ${target.displayName}'s Reputation`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'Reputation', value: `**${rep}**`, inline: true },
        { name: 'Rank', value: `#${rank}`, inline: true },
        { name: 'Recent Changes', value: recentChanges },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
