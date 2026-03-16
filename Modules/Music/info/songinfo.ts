import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue, formatDuration } from '../helpers';
import { errorContainer, moduleContainer, addText, addFields, addSectionWithThumbnail, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('songinfo')
    .setDescription('Get detailed information about a track')
    .addIntegerOption((opt) =>
      opt
        .setName('position')
        .setDescription('Queue position to check (default: current track)')
        .setMinValue(1)
        .setRequired(false)
    ),

  module: 'music',
  premiumFeature: 'music.basic',
  permissionPath: 'music.songinfo',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    const guildId = interaction.guildId!;
    const position = interaction.options.getInteger('position');
    const queue = getQueue(guildId);

    // Check if queue exists
    if (!queue || !queue.currentTrack) {
      await interaction.editReply(v2Payload([errorContainer('No Active Queue', 'There is no active music queue in this server.')]));
      return;
    }

    let track = queue.currentTrack;
    let displayPosition = 'Now Playing';

    // If position is specified, get that track from queue
    if (position !== null) {
      const queueIndex = position - 1;

      if (queueIndex >= queue.tracks.length) {
        await interaction.editReply(v2Payload([errorContainer('Invalid Position', `Position ${position} is out of range. Queue has ${queue.tracks.length} tracks.`)]));
        return;
      }

      track = queue.tracks[queueIndex];
      displayPosition = `Position #${position}`;
    }

    // Build detailed track info
    const sourceIcon = getSourceIcon(track.sourceName);
    const duration = formatDuration(track.duration);

    const container = moduleContainer('music');

    // Add track information with thumbnail if available
    if (track.artworkUrl) {
      addSectionWithThumbnail(
        container,
        `### ${sourceIcon} Track Information\n**[${track.title}](${track.uri})`,
        track.artworkUrl
      );
    } else {
      addText(container, `### ${sourceIcon} Track Information\n**[${track.title}](${track.uri})`);
    }

    const fields = [
      {
        name: 'Artist',
        value: track.author || 'Unknown',
        inline: true,
      },
      {
        name: 'Queue Position',
        value: displayPosition,
        inline: true,
      },
      {
        name: 'Duration',
        value: duration,
        inline: true,
      },
      {
        name: 'Platform',
        value: formatSourceName(track.sourceName),
        inline: true,
      },
      {
        name: 'Requested by',
        value: `<@${track.requestedBy}>`,
        inline: true,
      },
      {
        name: 'Track URL',
        value: `[Click here](${track.uri})`,
        inline: true,
      },
    ];

    // Add additional info if currently playing
    if (!position) {
      const currentTime = formatDuration(queue.position);
      const progress = buildProgressBar(queue.position, track.duration, 15);

      fields.push(
        {
          name: 'Progress',
          value: `${progress}\n\`${currentTime} / ${duration}\``,
          inline: false,
        },
        {
          name: 'Queue Size',
          value: `${queue.tracks.length} track${queue.tracks.length !== 1 ? 's' : ''} remaining`,
          inline: true,
        },
        {
          name: 'Loop Mode',
          value: queue.loop === 'off' ? 'Off' : queue.loop.charAt(0).toUpperCase() + queue.loop.slice(1),
          inline: true,
        }
      );

      // Add filters if active
      if (queue.filters.length > 0) {
        fields.push({
          name: 'Active Filters',
          value: queue.filters.join(', '),
          inline: false,
        });
      }
    }

    addFields(container, fields);

    await interaction.editReply(v2Payload([container]));
  },
};

/**
 * Get source icon emoji
 */
function getSourceIcon(sourceName: string): string {
  const lowerSource = sourceName.toLowerCase();
  if (lowerSource.includes('youtube')) return '🎥';
  if (lowerSource.includes('spotify')) return '🎵';
  if (lowerSource.includes('soundcloud')) return '☁️';
  if (lowerSource.includes('apple')) return '🍎';
  if (lowerSource.includes('twitch')) return '📺';
  if (lowerSource.includes('bandcamp')) return '🎼';
  if (lowerSource.includes('vimeo')) return '🎬';
  return '🎵';
}

/**
 * Format source name for display
 */
function formatSourceName(sourceName: string): string {
  const lowerSource = sourceName.toLowerCase();

  if (lowerSource.includes('youtube')) return 'YouTube';
  if (lowerSource.includes('spotify')) return 'Spotify';
  if (lowerSource.includes('soundcloud')) return 'SoundCloud';
  if (lowerSource.includes('apple')) return 'Apple Music';
  if (lowerSource.includes('twitch')) return 'Twitch';
  if (lowerSource.includes('bandcamp')) return 'Bandcamp';
  if (lowerSource.includes('vimeo')) return 'Vimeo';

  // Capitalize first letter
  return sourceName.charAt(0).toUpperCase() + sourceName.slice(1);
}

/**
 * Build a visual progress bar
 */
function buildProgressBar(
  current: number,
  total: number,
  length: number = 10
): string {
  if (total === 0) return '▬'.repeat(length);

  const percentage = Math.max(0, Math.min(1, current / total));
  const filledLength = Math.round(length * percentage);

  let bar = '';
  for (let i = 0; i < length; i++) {
    if (i < filledLength - 1) {
      bar += '▬';
    } else if (i === filledLength - 1) {
      bar += '🔘';
    } else {
      bar += '▬';
    }
  }

  return bar;
}

export default command;
