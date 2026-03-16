import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('TempVoice');
import { getTempVCByChannelId, auditLog } from '../helpers';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command = new SlashCommandBuilder()
  .setName('vckick')
  .setDescription('Kick a user from your temporary voice channel')
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('User to kick')
      .setRequired(true)
  );

export const vckick: BotCommand = {
  data: command,
  module: 'tempvoice',
  permissionPath: 'modules.tempvoice',
  cooldown: 0,

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const guild = interaction.guild;
      const user = interaction.user;
      const member = interaction.member;
      const targetUser = interaction.options.getUser('user');

      if (!guild || !user || !member || !targetUser) {
        return interaction.editReply('Required parameters not found.');
      }

      if (targetUser.id === user.id) {
        return interaction.editReply('You cannot kick yourself.');
      }

      // Check if user is in a voice channel
      const voiceChannel = (member as any).voice?.channel;
      if (!voiceChannel) {
        return interaction.editReply('You must be in a voice channel to use this command.');
      }

      // Check if it's a temp VC owned by user
      const tempVC = await getTempVCByChannelId(voiceChannel.id);
      if (!tempVC) {
        return interaction.editReply('You are not in a temporary voice channel.');
      }

      if (tempVC.ownerId !== user.id) {
        return interaction.editReply('You do not own this temporary voice channel.');
      }

      // Get target member
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        return interaction.editReply('User not found.');
      }

      // Check if target is in the VC
      if (targetMember.voice.channelId !== voiceChannel.id) {
        return interaction.editReply('That user is not in your voice channel.');
      }

      // Kick the user
      await targetMember.voice.disconnect('Kicked from temporary voice channel');

      await auditLog(guild, 'temp_vc_user_kicked', voiceChannel.id, user.id, {
        targetUser: targetUser.id,
      });

      const container = moduleContainer('temp_voice').setAccentColor(0xff6600);
      addText(container, `### User Kicked\n${targetUser.username} has been kicked from your voice channel.`);

      logger.info('[TempVoice] User kicked from temp VC:', targetUser.id, 'channel:', voiceChannel.id);
      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error('[TempVoice] Error executing /vckick command:', error);
      return interaction.editReply('An error occurred while kicking the user.');
    }
  },
};

export default vckick;
