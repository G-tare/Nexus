import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('TempVoice');
import { getTempVCByChannelId } from '../helpers';

const command = new SlashCommandBuilder()
  .setName('vcinfo')
  .setDescription('Show information about your temporary voice channel');

export const vcinfo: BotCommand = {
  data: command,
  module: 'tempvoice',
  permissionPath: 'modules.tempvoice',
  cooldown: 0,

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const user = interaction.user;
      const member = interaction.member;

      if (!guild || !user || !member) {
        return interaction.editReply('Guild, user, or member not found.');
      }

      // Check if user is in a voice channel
      const voiceChannel = (member as any).voice?.channel;
      if (!voiceChannel) {
        return interaction.editReply('You must be in a voice channel to use this command.');
      }

      // Check if it's a temp VC
      const tempVC = await getTempVCByChannelId(voiceChannel.id);
      if (!tempVC) {
        return interaction.editReply('You are not in a temporary voice channel.');
      }

      // Gather info
      const owner = await guild.members.fetch(tempVC.ownerId).catch(() => null);
      const ownerName = owner?.user.username || 'Unknown User';
      const createdAt = tempVC.createdAt;
      const uptime = Math.floor((Date.now() - createdAt.getTime()) / 1000);
      const members = voiceChannel.members;
      const isLocked = tempVC.lockedBy && tempVC.lockedBy.length > 0;
      const userLimit = voiceChannel.userLimit || 0;
      const permittedUsers = tempVC.permittedUsers || [];
      const deniedUsers = tempVC.deniedUsers || [];

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Temporary Voice Channel Info')
        .addFields(
          { name: 'Channel', value: `<#${voiceChannel.id}>`, inline: true },
          { name: 'Owner', value: ownerName, inline: true },
          { name: 'Members', value: `${members.size}${userLimit > 0 ? `/${userLimit}` : ''}`, inline: true },
          { name: 'Created', value: `<t:${Math.floor(createdAt.getTime() / 1000)}:R>`, inline: true },
          { name: 'Uptime', value: `${uptime}s`, inline: true },
          { name: 'Status', value: isLocked ? '🔒 Locked' : '🔓 Unlocked', inline: true }
        );

      if (permittedUsers.length > 0) {
        embed.addFields({
          name: 'Permitted Users',
          value: permittedUsers.map((id) => `<@${id}>`).join(', ') || 'None',
        });
      }

      if (deniedUsers.length > 0) {
        embed.addFields({
          name: 'Denied Users',
          value: deniedUsers.map((id) => `<@${id}>`).join(', ') || 'None',
        });
      }

      logger.info('[TempVoice] User viewed temp VC info:', voiceChannel.id);
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('[TempVoice] Error executing /vcinfo command:', error);
      return interaction.editReply('An error occurred while retrieving channel information.');
    }
  },
};

export default vcinfo;
