import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getQueue,
  deleteQueue,
  isDJ,
  getMusicConfig,
} from '../helpers';
import { errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback and clear the queue'),

  module: 'music',
  permissionPath: 'music.stop',
  premiumFeature: 'music.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const member = interaction.guild?.members.cache.get(interaction.user.id);

    // Check if user is in a voice channel
    if (!member?.voice.channel) {
      return interaction.editReply(
        v2Payload([errorContainer('Not in Voice', 'You must be in a voice channel to use this command.')])
      );
    }

    const queue = getQueue(interaction.guild!.id);

    // Check if there's an active queue
    if (!queue || queue.currentTrack === null) {
      return interaction.editReply(
        v2Payload([errorContainer('No Music Playing', 'There is no music currently playing.')])
      );
    }

    // Check if user is in the same voice channel as the bot
    if (queue.voiceChannelId !== member.voice.channel.id) {
      return interaction.editReply(
        v2Payload([errorContainer('Wrong Voice Channel', 'You must be in the same voice channel as the bot to use this command.')])
      );
    }

    // Check DJ requirement
    const config = await getMusicConfig(interaction.guild!.id);
    if (!member || !isDJ(member, config)) {
      return interaction.editReply(
        v2Payload([errorContainer('DJ Required', 'You must be a DJ to use this command.')])
      );
    }

    // Lavalink: player.stopTrack();
    // Lavalink: player.disconnect(); (unless 24/7 mode is enabled)

    // Clear queue from memory
    deleteQueue(interaction.guild!.id);

    const container = errorContainer('Playback Stopped', 'The queue has been cleared and playback has stopped.');

    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

export default command;
