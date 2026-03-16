import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('TempVoice');
import { getTempVCByChannelId, auditLog, lockChannel, unlockChannel, updateTempVC } from '../helpers';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command = new SlashCommandBuilder()
  .setName('vclock')
  .setDescription('Lock or unlock your temporary voice channel')
  .addStringOption((option) =>
    option
      .setName('action')
      .setDescription('Lock or unlock the channel')
      .setRequired(true)
      .addChoices(
        { name: 'Lock', value: 'lock' },
        { name: 'Unlock', value: 'unlock' }
      )
  );

export const vclock: BotCommand = {
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
      const action = interaction.options.getString('action');

      if (!guild || !user || !member || !action) {
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

      // Perform action
      if (action === 'lock') {
        await lockChannel(voiceChannel);
        await updateTempVC(voiceChannel.id, { lockedBy: [user.id] });

        await auditLog(guild, 'temp_vc_locked', voiceChannel.id, user.id);

        const container = moduleContainer('temp_voice').setAccentColor(0xff6600);
        addText(container, '### Channel Locked\nYour temporary voice channel is now locked. Only the owner can join.');

        logger.info('[TempVoice] User locked temp VC:', voiceChannel.id);
        return interaction.editReply(v2Payload([container]));
      } else {
        await unlockChannel(voiceChannel);
        await updateTempVC(voiceChannel.id, { lockedBy: [] });

        await auditLog(guild, 'temp_vc_unlocked', voiceChannel.id, user.id);

        const container = moduleContainer('temp_voice').setAccentColor(0x00ff00);
        addText(container, '### Channel Unlocked\nYour temporary voice channel is now unlocked. Anyone can join.');

        logger.info('[TempVoice] User unlocked temp VC:', voiceChannel.id);
        return interaction.editReply(v2Payload([container]));
      }
    } catch (error) {
      logger.error('[TempVoice] Error executing /vclock command:', error);
      return interaction.editReply('An error occurred while locking/unlocking the channel.');
    }
  },
};

export default vclock;
