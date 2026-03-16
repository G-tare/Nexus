import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getQueue,
  isDJ,
  getMusicConfig,
} from '../helpers';
import { errorContainer, moduleContainer, addText, addSeparator, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track'),

  module: 'music',
  permissionPath: 'music.skip',
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

    // Get current track before skipping
    const currentTrack = queue.currentTrack;

    // If loop is set to 'track', disable it before skipping
    if (queue.loop === 'track') {
      queue.loop = 'off';
    }

    // Remove and skip current track
    queue.tracks.shift();

    // Lavalink: if (queue.tracks.length > 0) {
    //   player.playTrack({ track: { encoded: queue.tracks[0].encoded } });
    // } else {
    //   player.stopTrack();
    // }

    const container = moduleContainer('music');
    addText(container, `### Track Skipped\nSkipped: **${currentTrack.title}**\nby ${currentTrack.author}`);

    if (queue.tracks.length > 0) {
      addSeparator(container, 'small');
      addText(container, `### Now Playing\n**${queue.tracks[0].title}**\nby ${queue.tracks[0].author}`);
    } else {
      addText(container, '\nQueue is now empty.');
    }

    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

export default command;
