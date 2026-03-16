import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('TempVoice');
import { getTempVCByChannelId, auditLog } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command = new SlashCommandBuilder()
  .setName('vcname')
  .setDescription('Rename your temporary voice channel')
  .addStringOption((option) =>
    option
      .setName('name')
      .setDescription('New name for the channel')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(100)
  );

export const vcname: BotCommand = {
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
      const newName = interaction.options.getString('name');

      if (!guild || !user || !member || !newName) {
        return interaction.editReply('Required parameters not found.');
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

      // Rename the channel
      const oldName = voiceChannel.name;
      await voiceChannel.setName(newName);

      await auditLog(guild, 'temp_vc_renamed', voiceChannel.id, user.id, {
        oldName,
        newName,
      });

      const container = moduleContainer('temp_voice').setAccentColor(0x0099ff);
      addText(container, '### Channel Renamed\nSuccessfully renamed your channel');
      addFields(container, [
        { name: 'Old Name', value: oldName, inline: true },
        { name: 'New Name', value: newName, inline: true }
      ]);

      logger.info('[TempVoice] User renamed temp VC:', voiceChannel.id, 'from:', oldName, 'to:', newName);
      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error('[TempVoice] Error executing /vcname command:', error);
      return interaction.editReply('An error occurred while renaming the channel.');
    }
  },
};

export default vcname;
