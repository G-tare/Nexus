import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('TempVoice');
import { banUser, isUserBanned, auditLog } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command = new SlashCommandBuilder()
  .setName('vcban')
  .setDescription('Ban a user from creating temporary voice channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('User to ban')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('reason')
      .setDescription('Reason for ban')
      .setRequired(false)
  );

export const vcban: BotCommand = {
  data: command,
  module: 'tempvoice',
  permissionPath: 'modules.tempvoice.staff.ban',
  cooldown: 0,

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply();

      const guild = interaction.guild;
      const user = interaction.user;
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      if (!guild || !targetUser) {
        return interaction.editReply('Guild or user not found.');
      }

      if (targetUser.id === user.id) {
        return interaction.editReply('You cannot ban yourself.');
      }

      // Check if already banned
      if (await isUserBanned(guild, targetUser.id)) {
        return interaction.editReply(`${targetUser.username} is already banned from creating temporary voice channels.`);
      }

      // Ban the user
      await banUser(guild, targetUser.id);

      await auditLog(guild, 'temp_vc_user_banned', targetUser.id, user.id, {
        reason,
      });

      const container = moduleContainer('temp_voice').setAccentColor(0xff0000);
      addText(container, `### User Banned\n${targetUser.username} has been banned from creating temporary voice channels.`);
      addFields(container, [
        { name: 'User', value: targetUser.username, inline: true },
        { name: 'Banned By', value: user.username, inline: true },
        { name: 'Reason', value: reason }
      ]);

      logger.info('[TempVoice] Staff banned user from creating temp VCs:', targetUser.id, 'reason:', reason);
      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error('[TempVoice] Error executing /vcban command:', error);
      return interaction.editReply('An error occurred while banning the user.');
    }
  },
};

export default vcban;
