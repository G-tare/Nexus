import {
  Client,
  Events,
  GuildMember,
} from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { getDb, getRedis } from '../../Shared/src/database/connection';
import { eventBus } from '../../Shared/src/events/eventBus';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  getStatsChannels,
  getStatsConfig,
  updateAllStatsChannels,
} from './helpers';
import { sql } from 'drizzle-orm';

const logger = createModuleLogger('StatsChannels:Events');

// Track update intervals per guild
const updateIntervals = new Map<string, NodeJS.Timeout>();

// ============================================
// Client Ready — Start Update Loops
// ============================================

const clientReadyHandler: ModuleEvent = { event: Events.ClientReady,
  once: true,
  async handler(client: Client) {
    logger.info('Starting stats channel update loops');

    // Start update loops for all guilds that have stats channels
    for (const [guildId, guild] of client.guilds.cache) {
      const channels = await getStatsChannels(guildId);
      if (channels.length === 0) continue;

      const config = await getStatsConfig(guildId);
      startUpdateLoop(client, guildId, config.updateInterval);
    }

    // Listen for new stats channels being created (to start loops for new guilds)
    eventBus.on('statsChannelCreated' as any, async ({ guildId }: { guildId: string }) => {
      if (!updateIntervals.has(guildId)) {
        const config = await getStatsConfig(guildId);
        startUpdateLoop(client, guildId, config.updateInterval);
      }
    });

    logger.info(`Stats update loops started for ${updateIntervals.size} guilds`);
  },
};

/**
 * Start a periodic update loop for a guild.
 */
function startUpdateLoop(client: Client, guildId: string, intervalSeconds: number) {
  // Clear existing interval if any
  const existing = updateIntervals.get(guildId);
  if (existing) clearInterval(existing);

  const interval = setInterval(async () => {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      // Guild no longer available, stop the loop
      clearInterval(interval);
      updateIntervals.delete(guildId);
      return;
    }

    try {
      await updateAllStatsChannels(guild);
    } catch (err: any) {
      logger.error('Stats update loop error', { guildId, error: err.message });
    }
  }, Math.max(intervalSeconds, 300) * 1000); // Minimum 5 minutes

  updateIntervals.set(guildId, interval);
}

// ============================================
// Member Join — Immediate Update
// ============================================

const memberJoinHandler: ModuleEvent = { event: Events.GuildMemberAdd,
  async handler(member: GuildMember) {
    const channels = await getStatsChannels(member.guild.id);
    if (channels.length === 0) return;

    // Only update member-related stats immediately
    const memberTypes = ['members', 'humans', 'bots', 'goal', 'online'];
    const relevantChannels = channels.filter(c => memberTypes.includes(c.statType));
    if (relevantChannels.length === 0) return;

    // Debounce: wait 3 seconds to batch multiple joins
    const redis = getRedis();
    const debounceKey = `stats:debounce:join:${member.guild.id}`;
    const debouncing = await redis.get(debounceKey);
    if (debouncing) return;

    await redis.setex(debounceKey, 3, '1');

    setTimeout(async () => {
      try {
        await updateAllStatsChannels(member.guild);
      } catch (err: any) {
        logger.error('Immediate stats update failed on join', { error: err.message });
      }
    }, 3000);
  },
};

// ============================================
// Member Leave — Immediate Update
// ============================================

const memberLeaveHandler: ModuleEvent = { event: Events.GuildMemberRemove,
  async handler(member: GuildMember) {
    const channels = await getStatsChannels(member.guild.id);
    if (channels.length === 0) return;

    const memberTypes = ['members', 'humans', 'bots', 'goal', 'online'];
    const relevantChannels = channels.filter(c => memberTypes.includes(c.statType));
    if (relevantChannels.length === 0) return;

    const redis = getRedis();
    const debounceKey = `stats:debounce:leave:${member.guild.id}`;
    const debouncing = await redis.get(debounceKey);
    if (debouncing) return;

    await redis.setex(debounceKey, 3, '1');

    setTimeout(async () => {
      try {
        await updateAllStatsChannels(member.guild);
      } catch (err: any) {
        logger.error('Immediate stats update failed on leave', { error: err.message });
      }
    }, 3000);
  },
};

// ============================================
// Channel Delete — Clean up if stats channel deleted
// ============================================

const channelDeleteHandler: ModuleEvent = { event: Events.ChannelDelete,
  async handler(channel: any) {
    if (!channel.guild) return;

    const db = getDb();
    const redis = getRedis();

    try {
      await db.execute(sql`
        DELETE FROM stats_channels
        WHERE guild_id = ${channel.guild.id} AND channel_id = ${channel.id}
      `);
      await redis.del(`stats:channels:${channel.guild.id}`);
    } catch { /* ignore */ }
  },
};

export const statsChannelsEvents: ModuleEvent[] = [
  clientReadyHandler,
  memberJoinHandler,
  memberLeaveHandler,
  channelDeleteHandler,
];
