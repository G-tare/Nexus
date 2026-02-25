import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors } from '../../../Shared/src/utils/embed';
import { discordTimestamp } from '../../../Shared/src/utils/time';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('mutelist')
    .setDescription('View all currently muted (timed out) users')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.mutelist',
  premiumFeature: 'moderation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    await interaction.deferReply({});

    const members = await guild.members.fetch();
    const muted = members.filter(m => m.isCommunicationDisabled());

    if (muted.size === 0) {
      await interaction.editReply({ content: 'No users are currently muted.' });
      return;
    }

    const lines = muted.map(m => {
      const until = m.communicationDisabledUntil;
      const timeStr = until ? `Expires: ${discordTimestamp(until, 'R')}` : 'Unknown expiry';
      return `**${m.user.tag}** (${m.id}) — ${timeStr}`;
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.Moderation)
      .setTitle('Currently Muted Users')
      .setDescription(lines.join('\n').slice(0, 4096))
      .setFooter({ text: `${muted.size} user(s) muted` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
