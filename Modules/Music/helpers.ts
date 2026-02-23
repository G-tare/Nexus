import {
  Guild,
  GuildMember,
  VoiceChannel,
  StageChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedField,
} from 'discord.js';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { getRedis, getDb } from '../../Shared/src/database/connection';
import { playlists } from '../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import { Colors } from '../../Shared/src/utils/embed';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Music');

// ============================================================================
// TYPES
// ============================================================================

export interface MusicConfig {
  enabled: boolean;

  // DJ system (optional)
  djEnabled: boolean;
  djRoleId?: string;
  djOnlyCommands: string[]; // command names that require DJ role (e.g. 'skip', 'stop', 'clear', 'filters')

  // Playback defaults
  defaultVolume: number; // 0-150, default 80
  maxVolume: number; // max allowed volume, default 150
  maxQueueSize: number; // 0 = unlimited, default 500
  maxSongDuration: number; // seconds, 0 = unlimited, default 0

  // Vote skip
  voteSkipEnabled: boolean;
  voteSkipPercent: number; // % of voice channel members needed, default 50

  // Channels
  restrictedChannels: string[]; // only allow music commands in these channels (empty = all)
  restrictedVoiceChannels: string[]; // only allow playing in these voice channels (empty = all)

  // Auto-play / auto-queue
  autoplayEnabled: boolean; // auto-play related tracks when queue ends

  // 24/7 mode
  twentyFourSevenEnabled: boolean; // stay in voice channel even when no one is listening
  twentyFourSevenChannelId?: string;

  // Server playlists
  serverPlaylistsEnabled: boolean;

  // Announcements
  announceNowPlaying: boolean; // send embed when new track starts
  announceChannelId?: string; // if set, announce in this channel; otherwise in the command channel

  // Inactivity
  leaveOnEmpty: boolean; // leave VC when empty
  leaveOnEmptyDelay: number; // seconds to wait before leaving, default 300
  leaveOnFinish: boolean; // leave when queue finishes (if 24/7 not on)
  leaveOnFinishDelay: number;
}

export interface Track {
  encoded: string; // Lavalink encoded track
  title: string;
  author: string;
  uri: string;
  duration: number; // ms
  artworkUrl?: string;
  sourceName: string; // youtube, soundcloud, spotify, etc.
  requestedBy: string; // user ID
  requestedByName: string; // username
}

export interface GuildQueue {
  guildId: string;
  textChannelId: string;
  voiceChannelId: string;
  tracks: Track[];
  currentTrack: Track | null;
  previousTrack: Track | null;
  position: number; // current position in ms (for seek)
  volume: number;
  loop: 'off' | 'track' | 'queue';
  paused: boolean;
  filters: string[]; // active filter names
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MUSIC_CONFIG: MusicConfig = {
  enabled: true,
  djEnabled: false,
  djRoleId: undefined,
  djOnlyCommands: ['skip', 'stop', 'clear', 'filters'],
  defaultVolume: 80,
  maxVolume: 150,
  maxQueueSize: 500,
  maxSongDuration: 0,
  voteSkipEnabled: true,
  voteSkipPercent: 50,
  restrictedChannels: [],
  restrictedVoiceChannels: [],
  autoplayEnabled: false,
  twentyFourSevenEnabled: false,
  twentyFourSevenChannelId: undefined,
  serverPlaylistsEnabled: true,
  announceNowPlaying: true,
  announceChannelId: undefined,
  leaveOnEmpty: true,
  leaveOnEmptyDelay: 300,
  leaveOnFinish: true,
  leaveOnFinishDelay: 300,
};

const FILTER_PRESETS: Record<string, Record<string, number | Record<string, number>>> = {
  bassboost: {
    'equalizer.0.gain': 0.1,
    'equalizer.1.gain': 0.1,
    'equalizer.2.gain': 0.05,
    'equalizer.3.gain': 0.05,
  },
  nightcore: {
    timescale: { speed: 1.2, pitch: 1.2, rate: 1.0 },
  },
  vaporwave: {
    timescale: { speed: 0.8, pitch: 0.8, rate: 1.0 },
  },
  '8d': {
    rotation: { rotationHz: 0.2 },
  },
  karaoke: {
    'equalizer.0.gain': -0.1,
    'equalizer.1.gain': -0.1,
    'equalizer.2.gain': -0.1,
    'equalizer.3.gain': -0.1,
    'equalizer.4.gain': -0.1,
  },
  tremolo: {
    tremolo: { frequency: 2.0, depth: 0.5 },
  },
  vibrato: {
    vibrato: { frequency: 2.0, depth: 0.5 },
  },
  lowpass: {
    lowPass: { smoothing: 20.0 },
  },
  highpass: {
    highPass: { smoothing: 20.0 },
  },
  pop: {
    'equalizer.0.gain': -0.1,
    'equalizer.1.gain': 0.1,
    'equalizer.2.gain': 0.1,
    'equalizer.3.gain': 0.05,
  },
  soft: {
    'equalizer.0.gain': -0.05,
    'equalizer.1.gain': 0.05,
    'equalizer.2.gain': 0.0,
    'equalizer.3.gain': -0.05,
  },
  treblebass: {
    'equalizer.0.gain': 0.15,
    'equalizer.1.gain': 0.1,
    'equalizer.2.gain': 0.0,
    'equalizer.3.gain': 0.1,
    'equalizer.4.gain': 0.15,
  },
};

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

const queues = new Map<string, GuildQueue>();

// ============================================================================
// CONFIG HELPERS
// ============================================================================

/**
 * Get music config for a guild with defaults
 */
export async function getMusicConfig(guildId: string): Promise<MusicConfig> {
  try {
    const configResult = await moduleConfig.getModuleConfig(guildId, 'music');
    const config = configResult?.config as MusicConfig | undefined;
    if (!config) {
      return DEFAULT_MUSIC_CONFIG;
    }
    // Merge with defaults to ensure all fields exist
    return { ...DEFAULT_MUSIC_CONFIG, ...config };
  } catch (error) {
    logger.error(`Failed to get music config for guild ${guildId}:`, error);
    return DEFAULT_MUSIC_CONFIG;
  }
}

// ============================================================================
// QUEUE HELPERS
// ============================================================================

/**
 * Get queue from memory map
 */
export function getQueue(guildId: string): GuildQueue | undefined {
  return queues.get(guildId);
}

/**
 * Create a new queue entry
 */
export function createQueue(
  guildId: string,
  textChannelId: string,
  voiceChannelId: string
): GuildQueue {
  const queue: GuildQueue = {
    guildId,
    textChannelId,
    voiceChannelId,
    tracks: [],
    currentTrack: null,
    previousTrack: null,
    position: 0,
    volume: DEFAULT_MUSIC_CONFIG.defaultVolume,
    loop: 'off',
    paused: false,
    filters: [],
  };

  queues.set(guildId, queue);
  logger.debug(`Created queue for guild ${guildId}`);
  return queue;
}

/**
 * Remove queue from memory
 */
export function destroyQueue(guildId: string): void {
  if (queues.delete(guildId)) {
    logger.debug(`Destroyed queue for guild ${guildId}`);
  }
}

// ============================================================================
// PERMISSION HELPERS
// ============================================================================

/**
 * Check if a member is a DJ
 * - If DJ system disabled, everyone is DJ
 * - If alone in VC, always DJ
 * - Check DJ role or admin permissions
 */
export function isDJ(member: GuildMember, config: MusicConfig): boolean {
  // DJ system disabled, everyone is DJ
  if (!config.djEnabled) {
    return true;
  }

  // Check if user is admin
  if (member.permissions.has('Administrator')) {
    return true;
  }

  // Check if alone in voice channel
  if (member.voice.channel && member.voice.channel.members.size === 1) {
    return true;
  }

  // Check DJ role
  if (config.djRoleId) {
    return member.roles.cache.has(config.djRoleId);
  }

  return false;
}

/**
 * Check if a command requires DJ permissions
 */
export function requiresDJ(commandName: string, config: MusicConfig): boolean {
  return config.djOnlyCommands.includes(commandName.toLowerCase());
}

// ============================================================================
// VOICE CHANNEL HELPERS
// ============================================================================

/**
 * Check if a member is in a voice channel
 */
export function isInVoiceChannel(
  member: GuildMember
): VoiceChannel | StageChannel | null {
  const channel = member.voice.channel;
  if (!channel) return null;
  if (channel.isVoiceBased()) return channel;
  return null;
}

/**
 * Check if member is in the same voice channel as the bot's queue
 */
export function isInSameVoice(member: GuildMember, queue: GuildQueue): boolean {
  return member.voice.channelId === queue.voiceChannelId;
}

// ============================================================================
// TIME & FORMATTING HELPERS
// ============================================================================

/**
 * Format milliseconds to mm:ss or hh:mm:ss
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return '00:00';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const h = hours;
    const m = minutes % 60;
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const m = minutes;
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Build a visual progress bar
 * Default length is 10 characters
 */
export function buildProgressBar(
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
  return '🎵';
}

// ============================================================================
// EMBED BUILDERS
// ============================================================================

/**
 * Build "Now Playing" embed
 */
export function buildNowPlayingEmbed(
  track: Track,
  queue: GuildQueue
): EmbedBuilder {
  const progressBar = buildProgressBar(queue.position, track.duration, 15);
  const currentTime = formatDuration(queue.position);
  const totalTime = formatDuration(track.duration);
  const sourceIcon = getSourceIcon(track.sourceName);

  const embed = new EmbedBuilder()
    .setColor(Colors.Primary as number)
    .setTitle(`${sourceIcon} Now Playing`)
    .setDescription(
      `**[${track.title}](${track.uri})**\nby ${track.author}`
    )
    .addFields(
      {
        name: 'Progress',
        value: `${progressBar}\n${currentTime} / ${totalTime}`,
        inline: false,
      },
      {
        name: 'Requested by',
        value: `<@${track.requestedBy}>`,
        inline: true,
      },
      {
        name: 'Volume',
        value: `${queue.volume}%`,
        inline: true,
      },
      {
        name: 'Loop',
        value: queue.loop === 'off' ? 'Off' : queue.loop.charAt(0).toUpperCase() + queue.loop.slice(1),
        inline: true,
      }
    );

  // Add filters if active
  if (queue.filters.length > 0) {
    embed.addFields({
      name: 'Filters',
      value: queue.filters.join(', '),
      inline: false,
    });
  }

  // Add artwork if available
  if (track.artworkUrl) {
    embed.setThumbnail(track.artworkUrl);
  }

  return embed;
}

/**
 * Build queue embed with pagination
 */
export function buildQueueEmbed(queue: GuildQueue, page: number = 1): EmbedBuilder {
  const itemsPerPage = 10;
  const totalPages = Math.ceil(queue.tracks.length / itemsPerPage);
  const validPage = Math.max(1, Math.min(page, totalPages || 1));

  const embed = new EmbedBuilder()
    .setColor(Colors.Primary as number)
    .setTitle('🎵 Queue');

  // Add now playing
  if (queue.currentTrack) {
    const currentTime = formatDuration(queue.position);
    const totalTime = formatDuration(queue.currentTrack.duration);
    embed.addFields({
      name: '▶️ Now Playing',
      value: `**[${queue.currentTrack.title}](${queue.currentTrack.uri})**\nby ${queue.currentTrack.author}\n\`${currentTime} / ${totalTime}\``,
      inline: false,
    });
  }

  // Add queue tracks
  if (queue.tracks.length === 0) {
    embed.addFields({
      name: 'Queue (Empty)',
      value: 'No tracks in queue',
      inline: false,
    });
  } else {
    const startIdx = (validPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const tracks = queue.tracks.slice(startIdx, endIdx);

    const queueText = tracks
      .map((track, idx) => {
        const position = startIdx + idx + 1;
        const duration = formatDuration(track.duration);
        return `${position}. **[${track.title}](${track.uri})**\n   \`${duration}\` • <@${track.requestedBy}>`;
      })
      .join('\n\n');

    embed.addFields({
      name: `Queue (${queue.tracks.length} track${queue.tracks.length !== 1 ? 's' : ''})`,
      value: queueText || 'Queue is empty',
      inline: false,
    });
  }

  // Calculate total queue duration
  const totalDuration = queue.tracks.reduce((acc, track) => acc + track.duration, 0);
  const totalDurationStr = formatDuration(totalDuration);

  embed.setFooter({
    text: `Page ${validPage}/${Math.max(1, totalPages)} • Total duration: ${totalDurationStr} • Loop: ${queue.loop}`,
  });

  return embed;
}

/**
 * Build "Track Added" embed
 */
export function buildTrackAddedEmbed(track: Track, position: number): EmbedBuilder {
  const sourceIcon = getSourceIcon(track.sourceName);
  const duration = formatDuration(track.duration);

  const embed = new EmbedBuilder()
    .setColor(Colors.Success as number)
    .setTitle(`${sourceIcon} Track Added to Queue`)
    .setDescription(
      `**[${track.title}](${track.uri})**\nby ${track.author}`
    )
    .addFields(
      {
        name: 'Position',
        value: `#${position}`,
        inline: true,
      },
      {
        name: 'Duration',
        value: duration,
        inline: true,
      },
      {
        name: 'Requested by',
        value: `<@${track.requestedBy}>`,
        inline: true,
      }
    );

  if (track.artworkUrl) {
    embed.setThumbnail(track.artworkUrl);
  }

  return embed;
}

// ============================================================================
// URL RESOLUTION HELPERS
// ============================================================================

/**
 * Parse Spotify URL and convert to search query
 * Supports tracks and playlists
 */
export async function resolveSpotify(uri: string): Promise<string | string[]> {
  try {
    // Extract track ID from Spotify URI/URL
    const trackMatch = uri.match(/(?:spotify\.com\/track\/|:track:)([a-zA-Z0-9]+)/);
    const playlistMatch = uri.match(
      /(?:spotify\.com\/playlist\/|:playlist:)([a-zA-Z0-9]+)/
    );

    if (trackMatch && trackMatch[1]) {
      // For individual tracks, you would normally fetch metadata from Spotify API
      // This is a simplified version that extracts from the URL
      // In production, integrate with Spotify API
      const trackId = trackMatch[1];
      logger.debug(`Resolved Spotify track: ${trackId}`);
      // Return a search query that can be used with Lavalink
      return `spsearch:${uri}`;
    }

    if (playlistMatch && playlistMatch[1]) {
      const playlistId = playlistMatch[1];
      logger.debug(`Resolved Spotify playlist: ${playlistId}`);
      // Return playlist search query
      return `spsearch:${uri}`;
    }

    logger.warn(`Could not parse Spotify URL: ${uri}`);
    return uri;
  } catch (error) {
    logger.error(`Error resolving Spotify URL: ${error}`);
    return uri;
  }
}

/**
 * Parse Apple Music URL and convert to search query
 * Supports tracks
 */
export async function resolveAppleMusic(uri: string): Promise<string> {
  try {
    // Extract track info from Apple Music URL
    const match = uri.match(/music\.apple\.com\/[a-z]+\/album\/([^/]+)\/(\d+)\?i=(\d+)/);

    if (match) {
      const trackName = decodeURIComponent(match[1]).replace(/-/g, ' ');
      logger.debug(`Resolved Apple Music track: ${trackName}`);
      return trackName;
    }

    logger.warn(`Could not parse Apple Music URL: ${uri}`);
    return uri;
  } catch (error) {
    logger.error(`Error resolving Apple Music URL: ${error}`);
    return uri;
  }
}

// ============================================================================
// FILTER HELPERS
// ============================================================================

/**
 * Get filter preset by name
 */
export function getFilterPreset(
  name: string
): Record<string, number | Record<string, number>> | undefined {
  return FILTER_PRESETS[name.toLowerCase()];
}

// ============================================================================
// PLAYLIST HELPERS
// ============================================================================

/**
 * Save a personal playlist to database
 */
export async function savePersonalPlaylist(
  userId: string,
  name: string,
  tracks: Track[]
): Promise<void> {
  try {
    const db = await getDb();
    const encoded = JSON.stringify(tracks);

    await db
      .insert(playlists)
      .values({
        userId,
        name: name.toLowerCase(),
        type: 'personal' as any,
        tracks: encoded,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .onConflictDoUpdate({
        target: [playlists.userId, playlists.name],
        set: {
          tracks: encoded,
        },
      });

    logger.debug(`Saved personal playlist "${name}" for user ${userId}`);
  } catch (error) {
    logger.error(`Failed to save personal playlist: ${error}`);
    throw error;
  }
}

/**
 * Load a personal playlist from database
 */
export async function loadPersonalPlaylist(
  userId: string,
  name: string
): Promise<Track[] | null> {
  try {
    const db = await getDb();
    const result = await db
      .select()
      .from(playlists)
      .where(
        and(
          eq(playlists.userId, userId),
          eq(playlists.name, name.toLowerCase()),
          eq((playlists as any).type, 'personal')
        )
      )
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    return JSON.parse(result[0].tracks as string);
  } catch (error) {
    logger.error(`Failed to load personal playlist: ${error}`);
    return null;
  }
}

/**
 * Get all personal playlist names for a user
 */
export async function getPersonalPlaylists(userId: string): Promise<string[]> {
  try {
    const db = await getDb();
    const results = await db
      .select({ name: playlists.name })
      .from(playlists)
      .where(
        and(
          eq(playlists.userId, userId),
          eq((playlists as any).type, 'personal')
        )
      );

    return results.map((r) => r.name);
  } catch (error) {
    logger.error(`Failed to get personal playlists: ${error}`);
    return [];
  }
}

/**
 * Delete a personal playlist from database
 */
export async function deletePersonalPlaylist(
  userId: string,
  name: string
): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db
      .delete(playlists)
      .where(
        and(
          eq(playlists.userId, userId),
          eq(playlists.name, name.toLowerCase()),
          eq((playlists as any).type, 'personal')
        )
      );

    logger.debug(`Deleted personal playlist "${name}" for user ${userId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to delete personal playlist: ${error}`);
    return false;
  }
}

/**
 * Save a server-level playlist to database
 */
export async function saveServerPlaylist(
  guildId: string,
  name: string,
  tracks: Track[],
  savedBy: string
): Promise<void> {
  try {
    const db = await getDb();
    const encoded = JSON.stringify(tracks);

    await db
      .insert(playlists)
      .values({
        userId: guildId,
        name: name.toLowerCase(),
        type: 'server' as any,
        tracks: encoded,
        createdBy: savedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .onConflictDoUpdate({
        target: [playlists.userId, playlists.name],
        set: {
          tracks: encoded,
        },
      });

    logger.debug(`Saved server playlist "${name}" for guild ${guildId}`);
  } catch (error) {
    logger.error(`Failed to save server playlist: ${error}`);
    throw error;
  }
}

/**
 * Load a server-level playlist from database
 */
export async function loadServerPlaylist(
  guildId: string,
  name: string
): Promise<Track[] | null> {
  try {
    const db = await getDb();
    const result = await db
      .select()
      .from(playlists)
      .where(
        and(
          eq(playlists.userId, guildId),
          eq(playlists.name, name.toLowerCase()),
          eq((playlists as any).type, 'server')
        )
      )
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    return JSON.parse(result[0].tracks as string);
  } catch (error) {
    logger.error(`Failed to load server playlist: ${error}`);
    return null;
  }
}

/**
 * Get all server playlist names
 */
export async function getServerPlaylists(guildId: string): Promise<string[]> {
  try {
    const db = await getDb();
    const results = await db
      .select({ name: playlists.name })
      .from(playlists)
      .where(
        and(
          eq(playlists.userId, guildId),
          eq((playlists as any).type, 'server')
        )
      );

    return results.map((r) => r.name);
  } catch (error) {
    logger.error(`Failed to get server playlists: ${error}`);
    return [];
  }
}

/**
 * Delete a server playlist from database
 */
export async function deleteServerPlaylist(
  guildId: string,
  name: string
): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db
      .delete(playlists)
      .where(
        and(
          eq(playlists.userId, guildId),
          eq(playlists.name, name.toLowerCase()),
          eq((playlists as any).type, 'server')
        )
      );

    logger.debug(`Deleted server playlist "${name}" for guild ${guildId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to delete server playlist: ${error}`);
    return false;
  }
}

// ============================================================================
// FAVORITES HELPERS
// ============================================================================

const REDIS_FAVORITES_PREFIX = 'music:favorites:';

/**
 * Save a track to user's favorites
 */
export async function saveFavorite(userId: string, track: Track): Promise<void> {
  try {
    const redis = await getRedis();
    const key = `${REDIS_FAVORITES_PREFIX}${userId}`;
    const encoded = JSON.stringify(track);

    await redis.hset(key, track.uri, encoded);
    await redis.expire(key, 86400 * 30); // 30 days

    logger.debug(`Saved favorite track for user ${userId}: ${track.title}`);
  } catch (error) {
    logger.error(`Failed to save favorite: ${error}`);
    throw error;
  }
}

/**
 * Remove a track from user's favorites
 */
export async function removeFavorite(
  userId: string,
  trackUri: string
): Promise<void> {
  try {
    const redis = await getRedis();
    const key = `${REDIS_FAVORITES_PREFIX}${userId}`;

    await redis.hdel(key, trackUri);

    logger.debug(`Removed favorite track for user ${userId}: ${trackUri}`);
  } catch (error) {
    logger.error(`Failed to remove favorite: ${error}`);
    throw error;
  }
}

/**
 * Get all favorite tracks for a user
 */
export async function getFavorites(userId: string): Promise<Track[]> {
  try {
    const redis = await getRedis();
    const key = `${REDIS_FAVORITES_PREFIX}${userId}`;

    const favorites = await redis.hgetall(key);

    if (!favorites || Object.keys(favorites).length === 0) {
      return [];
    }

    return Object.values(favorites)
      .map((json) => {
        try {
          return JSON.parse(json as string) as Track;
        } catch {
          return null;
        }
      })
      .filter((track) => track !== null) as Track[];
  } catch (error) {
    logger.error(`Failed to get favorites: ${error}`);
    return [];
  }
}

export function addTrack(guildId: string, track: Track): number {
  const queue = getQueue(guildId);
  if (!queue) return 0;
  queue.tracks.push(track);
  return queue.tracks.length;
}

export function deleteQueue(guildId: string): void {
  destroyQueue(guildId);
}
