import {
  Guild,
  ChannelType,
  VoiceChannel,
  CategoryChannel,
  GuildBasedChannel,
  PermissionFlagsBits,
} from 'discord.js';
import { getDb, getRedis } from '../../Shared/src/database/connection';
import { sql } from 'drizzle-orm';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('StatsChannels');

// ============================================
// Config Interface
// ============================================

export interface StatsChannelsConfig {
  enabled: boolean;

  // How often to update stats channels (in seconds, min 300 = 5 min)
  updateInterval: number;

  // Category name for stats channels
  categoryName: string;

  // Number formatting: 'full' (1,234) or 'short' (1.2K)
  numberFormat: 'full' | 'short';

  // Goal counter target (for goal stat type)
  goalTarget: number;
  goalStatType: StatType;
}

export const DEFAULT_STATS_CONFIG: StatsChannelsConfig = {
  enabled: true,
  updateInterval: 300,
  categoryName: '📊 Server Stats',
  numberFormat: 'full',
  goalTarget: 1000,
  goalStatType: 'members',
};

// ============================================
// Stat Types
// ============================================

export type StatType =
  | 'members'
  | 'humans'
  | 'bots'
  | 'roles'
  | 'channels'
  | 'boosts'
  | 'boost_level'
  | 'online'
  | 'categories'
  | 'emojis'
  | 'stickers'
  | 'text_channels'
  | 'voice_channels'
  | 'goal';

export const STAT_TYPE_LABELS: Record<StatType, string> = {
  members: 'Members',
  humans: 'Humans',
  bots: 'Bots',
  roles: 'Roles',
  channels: 'Channels',
  boosts: 'Boosts',
  boost_level: 'Boost Level',
  online: 'Online',
  categories: 'Categories',
  emojis: 'Emojis',
  stickers: 'Stickers',
  text_channels: 'Text Channels',
  voice_channels: 'Voice Channels',
  goal: 'Goal',
};

export const STAT_TYPE_EMOJIS: Record<StatType, string> = {
  members: '👥',
  humans: '🧑',
  bots: '🤖',
  roles: '🏷️',
  channels: '💬',
  boosts: '🚀',
  boost_level: '⭐',
  online: '🟢',
  categories: '📁',
  emojis: '😀',
  stickers: '🎨',
  text_channels: '📝',
  voice_channels: '🔊',
  goal: '🎯',
};

export const ALL_STAT_TYPES = Object.keys(STAT_TYPE_LABELS) as StatType[];

// ============================================
// Stats Channel Data
// ============================================

export interface StatsChannelEntry {
  id: number;
  guildId: string;
  channelId: string;
  categoryId: string | null;
  statType: StatType;
  labelTemplate: string; // e.g. "👥 {count} Members"
  createdBy: string;
  createdAt: Date;
}

// ============================================
// Fetch Stat Values
// ============================================

/**
 * Get the current value for a stat type in a guild.
 */
export async function getStatValue(guild: Guild, type: StatType): Promise<number> {
  switch (type) {
    case 'members':
      return guild.memberCount;

    case 'humans':
      // If members are cached, use that; otherwise approximate
      if (guild.members.cache.size > 10) {
        return guild.members.cache.filter(m => !m.user.bot).size;
      }
      // Fetch approximation
      try {
        await guild.members.fetch({ limit: 1 });
        return guild.members.cache.filter(m => !m.user.bot).size;
      } catch {
        // Fallback: estimate from total - bot count from cache
        const botCount = guild.members.cache.filter(m => m.user.bot).size;
        return Math.max(0, guild.memberCount - botCount);
      }

    case 'bots':
      if (guild.members.cache.size > 10) {
        return guild.members.cache.filter(m => m.user.bot).size;
      }
      try {
        await guild.members.fetch({ limit: 1 });
        return guild.members.cache.filter(m => m.user.bot).size;
      } catch {
        return guild.members.cache.filter(m => m.user.bot).size;
      }

    case 'roles':
      return guild.roles.cache.size - 1; // exclude @everyone

    case 'channels':
      return guild.channels.cache.size;

    case 'boosts':
      return guild.premiumSubscriptionCount || 0;

    case 'boost_level':
      return guild.premiumTier;

    case 'online':
      return guild.approximatePresenceCount || guild.members.cache.filter(
        m => m.presence?.status === 'online' || m.presence?.status === 'idle' || m.presence?.status === 'dnd'
      ).size;

    case 'categories':
      return guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

    case 'emojis':
      return guild.emojis.cache.size;

    case 'stickers':
      return guild.stickers.cache.size;

    case 'text_channels':
      return guild.channels.cache.filter(c =>
        c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement || c.type === ChannelType.GuildForum
      ).size;

    case 'voice_channels':
      return guild.channels.cache.filter(c =>
        c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice
      ).size;

    case 'goal': {
      const config = await getStatsConfig(guild.id);
      return await getStatValue(guild, config.goalStatType);
    }

    default:
      return 0;
  }
}

// ============================================
// Number Formatting
// ============================================

/**
 * Format a number based on config preference.
 */
export function formatNumber(value: number, format: 'full' | 'short'): string {
  if (format === 'short') {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString();
  }
  return value.toLocaleString();
}

// ============================================
// Label Template Parsing
// ============================================

/**
 * Render a label template with the current stat value.
 * Template can include {count}, {goal}, {percent}.
 */
export async function renderLabel(
  guild: Guild,
  entry: StatsChannelEntry,
  config: StatsChannelsConfig
): Promise<string> {
  const value = await getStatValue(guild, entry.statType);
  const formatted = formatNumber(value, config.numberFormat);

  let label = entry.labelTemplate
    .replace('{count}', formatted)
    .replace('{raw}', String(value));

  // Goal-specific replacements
  if (entry.statType === 'goal') {
    const goalFormatted = formatNumber(config.goalTarget, config.numberFormat);
    const percent = config.goalTarget > 0
      ? Math.min(100, Math.round((value / config.goalTarget) * 100))
      : 0;

    label = label
      .replace('{goal}', goalFormatted)
      .replace('{percent}', `${percent}%`);
  }

  // Discord voice channel names max 100 chars
  return label.slice(0, 100);
}

/**
 * Get the default label template for a stat type.
 */
export function getDefaultLabel(type: StatType): string {
  const emoji = STAT_TYPE_EMOJIS[type];
  const name = STAT_TYPE_LABELS[type];

  if (type === 'goal') {
    return `${emoji} {count}/{goal} ${name}`;
  }

  return `${emoji} {count} ${name}`;
}

// ============================================
// Stats Channel CRUD
// ============================================

/**
 * Get all stats channels for a guild.
 */
export async function getStatsChannels(guildId: string): Promise<StatsChannelEntry[]> {
  const db = getDb();
  const redis = getRedis();

  const cached = await redis.get(`stats:channels:${guildId}`);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* fall through */ }
  }

  const rows = (await db.execute(sql`
    SELECT id, guild_id as "guildId", channel_id as "channelId",
           type as "statType", format as "labelTemplate",
           custom_value as "customValue", last_updated as "lastUpdated"
    FROM stats_channels
    WHERE guild_id = ${guildId}
    ORDER BY id ASC
  `) as any).rows || [];

  await redis.setex(`stats:channels:${guildId}`, 300, JSON.stringify(rows));

  return rows;
}

/**
 * Get or create the stats category for a guild.
 */
export async function getOrCreateCategory(guild: Guild): Promise<CategoryChannel> {
  const config = await getStatsConfig(guild.id);

  // Check if a stats category already exists
  const existing = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name === config.categoryName
  ) as CategoryChannel | undefined;

  if (existing) return existing;

  // Create the category
  const category = await guild.channels.create({
    name: config.categoryName,
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: guild.id, // @everyone
        deny: [PermissionFlagsBits.Connect], // Prevent joining stats voice channels
      },
    ],
    reason: 'Stats Channels category created',
  });

  return category;
}

/**
 * Create a new stats channel.
 */
export async function createStatsChannel(params: {
  guild: Guild;
  statType: StatType;
  labelTemplate?: string;
  createdBy: string;
}): Promise<StatsChannelEntry | null> {
  const db = getDb();
  const redis = getRedis();
  const { guild, statType, createdBy } = params;

  const config = await getStatsConfig(guild.id);
  const labelTemplate = params.labelTemplate || getDefaultLabel(statType);

  // Get or create category
  const category = await getOrCreateCategory(guild);

  // Get the initial value for the channel name
  const tempEntry: StatsChannelEntry = {
    id: 0,
    guildId: guild.id,
    channelId: '',
    categoryId: category.id,
    statType,
    labelTemplate,
    createdBy,
    createdAt: new Date(),
  };

  const channelName = await renderLabel(guild, tempEntry, config);

  // Create the voice channel
  const voiceChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildVoice,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      },
    ],
    reason: `Stats channel created: ${statType}`,
  });

  // Store in database
  const [inserted] = (await db.execute(sql`
    INSERT INTO stats_channels (guild_id, channel_id, type, format, last_updated)
    VALUES (${guild.id}, ${voiceChannel.id}, ${statType}, ${labelTemplate}, NOW())
    RETURNING id, guild_id as "guildId", channel_id as "channelId",
              type as "statType", format as "labelTemplate",
              custom_value as "customValue", last_updated as "lastUpdated"
  `) as any).rows || [];

  await redis.del(`stats:channels:${guild.id}`);

  eventBus.emit('statsChannelCreated' as any, {
    guildId: guild.id,
    channelId: voiceChannel.id,
    statType,
  });

  logger.info('Stats channel created', { guildId: guild.id, type: statType, channelId: voiceChannel.id });

  return inserted || null;
}

/**
 * Delete a stats channel.
 */
export async function deleteStatsChannel(guild: Guild, entryId: number): Promise<boolean> {
  const db = getDb();
  const redis = getRedis();

  const channels = await getStatsChannels(guild.id);
  const entry = channels.find(c => c.id === entryId);
  if (!entry) return false;

  // Delete the Discord voice channel
  try {
    const channel = guild.channels.cache.get(entry.channelId);
    if (channel) {
      await channel.delete('Stats channel removed');
    }
  } catch (err: any) {
    logger.warn('Could not delete stats voice channel', { error: err.message });
  }

  // Delete from database
  await db.execute(sql`
    DELETE FROM stats_channels
    WHERE guild_id = ${guild.id} AND id = ${entryId}
  `);

  await redis.del(`stats:channels:${guild.id}`);

  // If no more stats channels, check if we should clean up the category
  const remaining = await getStatsChannels(guild.id);
  if (remaining.length === 0 && entry.categoryId) {
    try {
      const category = guild.channels.cache.get(entry.categoryId);
      if (category && category.type === ChannelType.GuildCategory) {
        const children = guild.channels.cache.filter(c => c.parentId === category.id);
        if (children.size === 0) {
          await category.delete('Stats category empty, cleaning up');
        }
      }
    } catch { /* ignore */ }
  }

  return true;
}

/**
 * Edit a stats channel's label or type.
 */
export async function editStatsChannel(params: {
  guild: Guild;
  entryId: number;
  newLabel?: string;
  newType?: StatType;
}): Promise<StatsChannelEntry | null> {
  const db = getDb();
  const redis = getRedis();
  const { guild, entryId, newLabel, newType } = params;

  const channels = await getStatsChannels(guild.id);
  const entry = channels.find(c => c.id === entryId);
  if (!entry) return null;

  const label = newLabel || entry.labelTemplate;
  const type = newType || entry.statType;

  // Update database
  await db.execute(sql`
    UPDATE stats_channels
    SET format = ${label}, type = ${type}
    WHERE guild_id = ${guild.id} AND id = ${entryId}
  `);

  await redis.del(`stats:channels:${guild.id}`);

  // Immediately update the channel name
  const config = await getStatsConfig(guild.id);
  const updatedEntry = { ...entry, labelTemplate: label, statType: type };
  const channelName = await renderLabel(guild, updatedEntry, config);

  try {
    const channel = guild.channels.cache.get(entry.channelId);
    if (channel) {
      await channel.setName(channelName, 'Stats channel updated');
    }
  } catch (err: any) {
    logger.warn('Could not rename stats channel', { error: err.message });
  }

  return updatedEntry;
}

// ============================================
// Update All Stats Channels
// ============================================

/**
 * Update all stats channels for a guild.
 * Respects Discord rate limits (2 channel renames per 10 min per channel).
 */
export async function updateAllStatsChannels(guild: Guild): Promise<number> {
  const channels = await getStatsChannels(guild.id);
  if (channels.length === 0) return 0;

  const config = await getStatsConfig(guild.id);
  const redis = getRedis();
  let updated = 0;

  for (const entry of channels) {
    // Rate limit check: track last update per channel
    const rateLimitKey = `stats:ratelimit:${entry.channelId}`;
    const lastUpdate = await redis.get(rateLimitKey);

    if (lastUpdate) {
      const elapsed = Date.now() - parseInt(lastUpdate);
      if (elapsed < 300_000) continue; // Skip if updated less than 5 min ago
    }

    try {
      const newName = await renderLabel(guild, entry, config);
      const channel = guild.channels.cache.get(entry.channelId);

      if (!channel) {
        // Channel was deleted externally, clean up
        const db = getDb();
        await db.execute(sql`
          DELETE FROM stats_channels
          WHERE guild_id = ${guild.id} AND channel_id = ${entry.channelId}
        `);
        await redis.del(`stats:channels:${guild.id}`);
        continue;
      }

      // Only rename if the name actually changed
      if (channel.name !== newName) {
        await channel.setName(newName, 'Stats auto-update');
        await redis.setex(rateLimitKey, 600, String(Date.now()));
        updated++;
      }
    } catch (err: any) {
      logger.error('Failed to update stats channel', {
        channelId: entry.channelId,
        error: err.message,
      });
    }
  }

  return updated;
}

// ============================================
// Config Helper
// ============================================

/**
 * Get the stats channels config for a guild.
 */
export async function getStatsConfig(guildId: string): Promise<StatsChannelsConfig> {
  const cfg = await moduleConfig.getModuleConfig<StatsChannelsConfig>(guildId, 'statschannels');
  return { ...DEFAULT_STATS_CONFIG, ...(cfg?.config || {}) };
}
