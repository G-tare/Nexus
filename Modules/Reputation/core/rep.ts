import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addSectionWithThumbnail, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';
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

    const container = moduleContainer('reputation');
    addSectionWithThumbnail(container, `### ⭐ ${target.displayName}'s Reputation`, target.displayAvatarURL());
    addText(container, `**Reputation:** ${rep}\n**Rank:** #${rank}`);
    addText(container, `**Recent Changes**\n${recentChanges}`);
    addFooter(container, `Requested by ${interaction.user.displayName}`);

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
