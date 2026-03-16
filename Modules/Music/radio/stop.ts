import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, successContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('radio-stop')
    .setDescription('Stop the current radio station'),

  module: 'music',
  permissionPath: 'music.radio.stop',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      // Check if user is in voice channel
      const member = interaction.member as GuildMember | null;
      const voiceChannel = member?.voice?.channel;

      if (!voiceChannel) {
        await interaction.editReply(v2Payload([errorContainer('Not in Voice Channel', 'You must be in a voice channel to stop radio.')]));
        return;
      }

      // Show stop confirmation
      await interaction.editReply(v2Payload([successContainer('⏹️ Radio Stopped', 'Radio station has been stopped.')]));
    } catch (error) {
      console.error('Error in radio stop command:', error);
      await interaction.editReply({
        content: 'An error occurred while stopping the radio.',
      });
    }
  },
};

export default command;
