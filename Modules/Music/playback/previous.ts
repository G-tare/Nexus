import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue } from '../helpers';

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
      const embed = new EmbedBuilder()
        .setDescription('You must be in a voice channel to use this command.')
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    const queue = getQueue(interaction.guild!.id);

    // Check if there's an active queue
    if (!queue || queue.tracks.length === 0) {
      const embed = new EmbedBuilder()
        .setDescription('There is no music currently playing.')
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    // Check if user is in the same voice channel as the bot
    if (queue.voiceChannelId !== member.voice.channel.id) {
      const embed = new EmbedBuilder()
        .setDescription('You must be in the same voice channel as the bot to use this command.')
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    // Check if there's a previous track
    if (!queue.previousTrack) {
      const embed = new EmbedBuilder()
        .setDescription('There is no previous track to play.')
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    const previousTrack = queue.previousTrack;
    const currentTrack = queue.tracks[0];

    // Insert current track back to the front of the queue
    queue.tracks.unshift(currentTrack);

    // Set the previous track as current
    queue.previousTrack = null;
    queue.tracks[0] = previousTrack;

    // Lavalink: player.playTrack({ track: { encoded: previousTrack.encoded } });
    // Lavalink: player.seek(0); // Reset to beginning of track

    const embed = new EmbedBuilder()
      .setTitle('Now Playing Previous Track')
      .setDescription(
        `**${previousTrack.title}**\nby ${previousTrack.author}`
      )
      .addFields([
        {
          name: 'Previous Track',
          value: `**${currentTrack.title}**\nby ${currentTrack.author}`,
          inline: false,
        },
      ])
      .setColor(0x51cf66);

    return interaction.editReply({ embeds: [embed] });
  },
};

export default command;
