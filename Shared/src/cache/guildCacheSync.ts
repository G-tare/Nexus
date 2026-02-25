/**
 * Guild Cache Sync — writes guild roles & members to Redis from the bot's gateway cache.
 *
 * The bot receives guild data via the Discord gateway (no REST API needed).
 * This module writes that data to Redis so the Express API can serve it instantly
 * without ever calling Discord's REST API.
 *
 * Cache keys:
 *   guild_roles:{guildId}     → JSON { roles: [...] }          TTL: none (refreshed by events)
 *   guild_members:{guildId}:  → JSON { members: [...] }        TTL: 10 minutes (auto-refreshes)
 */

import { getRedis } from '../database/connection';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('GuildCacheSync');

// Members TTL — auto-expire so stale data doesn't persist forever
const MEMBERS_TTL = 600; // 10 minutes

export interface CachedRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export interface CachedMember {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

/**
 * Write all roles for a guild to Redis.
 * Called on bot startup for every guild, and on role create/update/delete events.
 */
export async function syncGuildRoles(guildId: string, roles: CachedRole[]): Promise<void> {
  const redis = getRedis();
  const cacheKey = `guild_roles:${guildId}`;
  try {
    const sorted = roles
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position);
    await redis.set(cacheKey, JSON.stringify({ roles: sorted }));
    logger.debug('Synced guild roles to Redis', { guildId, count: sorted.length });
  } catch (err: any) {
    logger.warn('Failed to sync guild roles', { guildId, error: err.message });
  }
}

/**
 * Write a member snapshot for a guild to Redis.
 * Called on bot startup and periodically refreshed.
 * Uses the empty-query cache key so the Express API picks it up automatically.
 */
export async function syncGuildMembers(guildId: string, members: CachedMember[]): Promise<void> {
  const redis = getRedis();
  // This matches the cache key format the Express API already uses for empty-query searches
  const cacheKey = `guild_members:${guildId}:`;
  try {
    await redis.setex(cacheKey, MEMBERS_TTL, JSON.stringify({ members }));
    logger.debug('Synced guild members to Redis', { guildId, count: members.length });
  } catch (err: any) {
    logger.warn('Failed to sync guild members', { guildId, error: err.message });
  }
}

/**
 * Sync all guilds the bot is serving.
 * Called once on ClientReady.
 */
export async function syncAllGuilds(clientGuilds: Map<string, any>): Promise<void> {
  let synced = 0;

  for (const [, guild] of clientGuilds) {
    try {
      // Sync roles from gateway cache
      const roles: CachedRole[] = guild.roles.cache.map((r: any) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        position: r.position,
        managed: r.managed ?? false,
      }));
      await syncGuildRoles(guild.id, roles);

      // Sync member snapshot from gateway cache (up to 100)
      const members: CachedMember[] = guild.members.cache
        .filter((m: any) => !m.user.bot)
        .first(100)
        .map((m: any) => ({
          id: m.user.id,
          username: m.user.username,
          displayName: m.nickname ?? m.user.globalName ?? m.user.username,
          avatar: m.user.avatar
            ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.webp?size=64`
            : null,
        }));
      await syncGuildMembers(guild.id, members);

      synced++;
    } catch (err: any) {
      logger.warn('Failed to sync guild', { guildId: guild.id, error: err.message });
    }
  }

  logger.info(`Synced roles & members for ${synced} guilds to Redis`);
}

/**
 * Remove cached data for a guild the bot has left.
 */
export async function clearGuildCache(guildId: string): Promise<void> {
  const redis = getRedis();
  try {
    await redis.del(`guild_roles:${guildId}`);
    await redis.del(`guild_members:${guildId}:`);
    logger.debug('Cleared guild cache', { guildId });
  } catch (err: any) {
    logger.warn('Failed to clear guild cache', { guildId, error: err.message });
  }
}
