import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';
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

    const container = moduleContainer('moderation');
    addText(container, `### Currently Muted Users\n${lines.join('\n').slice(0, 4096)}`);
    addFooter(container, `${muted.size} user(s) muted`);

    await interaction.editReply(v2Payload([container]));
  },
};

export default command;
