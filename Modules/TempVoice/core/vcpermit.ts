import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('TempVoice');
import { getTempVCByChannelId, auditLog, permitUser, removeDeny, updateTempVC } from '../helpers';

const command = new SlashCommandBuilder()
  .setName('vcpermit')
  .setDescription('Allow or deny specific users from joining your locked temporary voice channel')
  .addStringOption((option) =>
    option
      .setName('action')
      .setDescription('Permit or deny a user')
      .setRequired(true)
      .addChoices(
        { name: 'Permit', value: 'permit' },
        { name: 'Deny', value: 'deny' }
      )
  )
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('User to permit or deny')
      .setRequired(true)
  );

export const vcpermit: BotCommand = {
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
      const action = interaction.options.getString('action');
      const targetUser = interaction.options.getUser('user');

      if (!guild || !user || !member || !action || !targetUser) {
        return interaction.editReply('Required parameters not found.');
      }

      if (targetUser.id === user.id) {
        return interaction.editReply('You cannot permit/deny yourself.');
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

      // Perform action
      if (action === 'permit') {
        await permitUser(voiceChannel, targetUser.id);

        const permittedUsers = tempVC.permittedUsers || [];
        if (!permittedUsers.includes(targetUser.id)) {
          permittedUsers.push(targetUser.id);
        }
        const deniedUsers = tempVC.deniedUsers || [];
        const updatedDenied = deniedUsers.filter((id) => id !== targetUser.id);

        await updateTempVC(voiceChannel.id, {
          permittedUsers,
          deniedUsers: updatedDenied,
        });

        await auditLog(guild, 'temp_vc_user_permitted', voiceChannel.id, user.id, {
          targetUser: targetUser.id,
        });

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('User Permitted')
          .setDescription(`${targetUser.username} can now join your channel.`);

        logger.info('[TempVoice] User permitted to join temp VC:', targetUser.id, 'channel:', voiceChannel.id);
        return interaction.editReply({ embeds: [embed] });
      } else {
        await removeDeny(voiceChannel, targetUser.id);

        const deniedUsers = tempVC.deniedUsers || [];
        if (!deniedUsers.includes(targetUser.id)) {
          deniedUsers.push(targetUser.id);
        }
        const permittedUsers = tempVC.permittedUsers || [];
        const updatedPermitted = permittedUsers.filter((id) => id !== targetUser.id);

        await updateTempVC(voiceChannel.id, {
          deniedUsers,
          permittedUsers: updatedPermitted,
        });

        await auditLog(guild, 'temp_vc_user_denied', voiceChannel.id, user.id, {
          targetUser: targetUser.id,
        });

        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('User Denied')
          .setDescription(`${targetUser.username} can no longer join your channel.`);

        logger.info('[TempVoice] User denied from joining temp VC:', targetUser.id, 'channel:', voiceChannel.id);
        return interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      logger.error('[TempVoice] Error executing /vcpermit command:', error);
      return interaction.editReply('An error occurred while permitting/denying the user.');
    }
  },
};

export default vcpermit;
