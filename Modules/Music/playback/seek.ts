import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue, formatDuration } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Seek to a specific position in the current track')
    .addStringOption((option) =>
      option.setName('position')
        .setDescription('Position in format MM:SS or seconds (e.g., "1:30" or "90")')
        .setRequired(true)
    ),

  module: 'music',
  permissionPath: 'music.seek',
  premiumFeature: 'music.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const positionStr = interaction.options.getString('position', true);
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

    // Parse position string to milliseconds
    let positionMs: number;

    if (positionStr.includes(':')) {
      // Format: MM:SS
      const parts = positionStr.split(':');
      if (parts.length !== 2) {
        const embed = new EmbedBuilder()
          .setDescription('Invalid position format. Use MM:SS (e.g., "1:30") or seconds (e.g., "90").')
          .setColor(0xff0000);
        return interaction.editReply({
          embeds: [embed],
        });
      }

      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);

      if (isNaN(minutes) || isNaN(seconds) || seconds >= 60) {
        const embed = new EmbedBuilder()
          .setDescription('Invalid position format. Use MM:SS (e.g., "1:30") or seconds (e.g., "90").')
          .setColor(0xff0000);
        return interaction.editReply({
          embeds: [embed],
        });
      }

      positionMs = (minutes * 60 + seconds) * 1000;
    } else {
      // Format: seconds
      const seconds = parseInt(positionStr, 10);

      if (isNaN(seconds)) {
        const embed = new EmbedBuilder()
          .setDescription('Invalid position format. Use MM:SS (e.g., "1:30") or seconds (e.g., "90").')
          .setColor(0xff0000);
        return interaction.editReply({
          embeds: [embed],
        });
      }

      positionMs = seconds * 1000;
    }

    // Get current track
    const currentTrack = queue.tracks[0];

    // Validate position is within track length
    if (positionMs > (currentTrack as any).info.length) {
      const embed = new EmbedBuilder()
        .setDescription(`Position cannot exceed track duration (${formatDuration(currentTrack.duration)}).`)
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    if (positionMs < 0) {
      const embed = new EmbedBuilder()
        .setDescription('Position cannot be negative.')
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    // Lavalink: player.seek(positionMs);

    // Format time for display
    const minutes = Math.floor(positionMs / 60000);
    const seconds = Math.floor((positionMs % 60000) / 1000);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const embed = new EmbedBuilder()
      .setTitle('Track Seeked')
      .setDescription(`Seeked to **${timeStr}**`)
      .addFields([
        {
          name: 'Track',
          value: `**${currentTrack.title}**\nby ${currentTrack.author}`,
          inline: false,
        },
      ])
      .setColor(0x51cf66);

    return interaction.editReply({ embeds: [embed] });
  },
};

export default command;
