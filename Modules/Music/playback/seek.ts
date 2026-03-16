import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue, formatDuration } from '../helpers';
import { errorContainer, moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

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

    // Parse position string to milliseconds
    let positionMs: number;

    if (positionStr.includes(':')) {
      // Format: MM:SS
      const parts = positionStr.split(':');
      if (parts.length !== 2) {
        return interaction.editReply(
          v2Payload([errorContainer('Invalid Format', 'Invalid position format. Use MM:SS (e.g., "1:30") or seconds (e.g., "90").')])
        );
      }

      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);

      if (isNaN(minutes) || isNaN(seconds) || seconds >= 60) {
        return interaction.editReply(
          v2Payload([errorContainer('Invalid Format', 'Invalid position format. Use MM:SS (e.g., "1:30") or seconds (e.g., "90").')])
        );
      }

      positionMs = (minutes * 60 + seconds) * 1000;
    } else {
      // Format: seconds
      const seconds = parseInt(positionStr, 10);

      if (isNaN(seconds)) {
        return interaction.editReply(
          v2Payload([errorContainer('Invalid Format', 'Invalid position format. Use MM:SS (e.g., "1:30") or seconds (e.g., "90").')])
        );
      }

      positionMs = seconds * 1000;
    }

    // Get current track
    const currentTrack = queue.currentTrack;

    // Validate position is within track length
    if (positionMs > currentTrack.duration) {
      return interaction.editReply(
        v2Payload([errorContainer('Position Too Long', `Position cannot exceed track duration (${formatDuration(currentTrack.duration)}).`)])
      );
    }

    if (positionMs < 0) {
      return interaction.editReply(
        v2Payload([errorContainer('Invalid Position', 'Position cannot be negative.')])
      );
    }

    // Lavalink: player.seek(positionMs);

    // Format time for display
    const minutes = Math.floor(positionMs / 60000);
    const seconds = Math.floor((positionMs % 60000) / 1000);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const container = moduleContainer('music');
    addText(container, `### Track Seeked\nSeeked to **${timeStr}**`);
    addFields(container, [
      {
        name: 'Track',
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
