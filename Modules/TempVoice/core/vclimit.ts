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
  .setName('vclimit')
  .setDescription('Set user limit for your temporary voice channel')
  .addIntegerOption((option) =>
    option
      .setName('limit')
      .setDescription('User limit (0 = unlimited)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(99)
  );

export const vclimit: BotCommand = {
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
      const limit = interaction.options.getInteger('limit');

      if (!guild || !user || !member || limit === null) {
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

      // Set user limit
      const oldLimit = voiceChannel.userLimit;
      await voiceChannel.setUserLimit(limit);

      await auditLog(guild, 'temp_vc_limit_changed', voiceChannel.id, user.id, {
        oldLimit,
        newLimit: limit,
      });

      const limitText = limit === 0 ? 'Unlimited' : limit.toString();
      const container = moduleContainer('temp_voice').setAccentColor(0x0099ff);
      addText(container, `### User Limit Updated\nUser limit set to **${limitText}**`);
      addFields(container, [
        { name: 'Old Limit', value: oldLimit === 0 ? 'Unlimited' : oldLimit.toString(), inline: true },
        { name: 'New Limit', value: limitText, inline: true }
      ]);

      logger.info('[TempVoice] User set limit for temp VC:', voiceChannel.id, 'limit:');
      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error('[TempVoice] Error executing /vclimit command:', error);
      return interaction.editReply('An error occurred while setting the user limit.');
    }
  },
};

export default vclimit;
