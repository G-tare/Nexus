import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('TempVoice');
import { unbanUser, isUserBanned, auditLog } from '../helpers';

const command = new SlashCommandBuilder()
  .setName('vcunban')
  .setDescription('Unban a user from creating temporary voice channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('User to unban')
      .setRequired(true)
  );

export const vcunban: BotCommand = {
  data: command,
  module: 'tempvoice',
  permissionPath: 'modules.tempvoice.staff.unban',
  cooldown: 0,

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const user = interaction.user;
      const targetUser = interaction.options.getUser('user');

      if (!guild || !targetUser) {
        return interaction.editReply('Guild or user not found.');
      }

      // Check if user is banned
      if (!(await isUserBanned(guild, targetUser.id))) {
        return interaction.editReply(`${targetUser.username} is not banned from creating temporary voice channels.`);
      }

      // Unban the user
      await unbanUser(guild, targetUser.id);

      await auditLog(guild, 'temp_vc_user_unbanned', targetUser.id, user.id);

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('User Unbanned')
        .setDescription(`${targetUser.username} has been unbanned from creating temporary voice channels.`)
        .addFields(
          { name: 'User', value: targetUser.username, inline: true },
          { name: 'Unbanned By', value: user.username, inline: true }
        );

      logger.info('[TempVoice] Staff unbanned user from creating temp VCs:', targetUser.id);
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('[TempVoice] Error executing /vcunban command:', error);
      return interaction.editReply('An error occurred while unbanning the user.');
    }
  },
};

export default vcunban;
