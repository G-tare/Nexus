import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue } from '../helpers';
import { errorContainer, successContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume playback'),

  module: 'music',
  permissionPath: 'music.resume',
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

    // Check if already playing
    if (!queue.paused) {
      return interaction.editReply(
        v2Payload([errorContainer('Already Playing', 'Music is already playing.')])
      );
    }

    // Resume playback
    queue.paused = false;

    // Lavalink: player.pause(false);

    const container = successContainer('Playback Resumed', 'Music is now playing.');

    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

export default command;
