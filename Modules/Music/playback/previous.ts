import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue } from '../helpers';
import { errorContainer, moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('previous')
    .setDescription('Play the previous track'),

  module: 'music',
  permissionPath: 'music.previous',
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

    // Check if there's a previous track
    if (!queue.previousTrack) {
      return interaction.editReply(
        v2Payload([errorContainer('No Previous Track', 'There is no previous track to play.')])
      );
    }

    const previousTrack = queue.previousTrack;
    const currentTrack = queue.currentTrack;

    // Insert current track back to the front of the queue
    queue.tracks.unshift(currentTrack);

    // Set the previous track as current
    queue.previousTrack = null;
    queue.currentTrack = previousTrack;

    // Lavalink: player.playTrack({ track: { encoded: previousTrack.encoded } });
    // Lavalink: player.seek(0); // Reset to beginning of track

    const container = moduleContainer('music');
    addText(container, `### Now Playing Previous Track\n**${previousTrack.title}**\nby ${previousTrack.author}`);
    addFields(container, [
      {
        name: 'Previous Track',
        value: `**${currentTrack.title}**\nby ${currentTrack.author}`,
        inline: false,
      },
    ]);

    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

export default command;
