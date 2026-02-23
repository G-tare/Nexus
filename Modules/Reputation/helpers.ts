import {
  Guild,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { getDb } from '../../Shared/src/database/connection';
import { getRedis } from '../../Shared/src/database/connection';
import { sql } from 'drizzle-orm';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Reputation');

// ============================================
// Config Interface
// ============================================

export interface ReputationConfig {
  /** Default reputation for new members */
  defaultRep: number;
  /** Cooldown between giving rep to the same user (seconds) */
  giveCooldown: number;
  /** Global cooldown between giving rep to anyone (seconds) */
  globalCooldown: number;
  /** Maximum rep a user can give per day */
  dailyLimit: number;
  /** Enable reputation decay (lose rep over inactivity) */
  decayEnabled: boolean;
  /** Days of inactivity before decay starts */
  decayAfterDays: number;
  /** Rep lost per decay tick */
  decayAmount: number;
  /** Minimum rep after decay (floor) */
  decayFloor: number;
  /** Emoji for upvote reactions */
  upvoteEmoji: string;
  /** Emoji for downvote reactions */
  downvoteEmoji: string;
  /** Enable reaction-based rep (upvote/downvote) */
  reactionRepEnabled: boolean;
  /** Channel where rep changes are logged */
  logChannelId: string | null;
  /** Allow self-rep */
  allowSelfRep: boolean;
  /** Negative rep allowed */
  allowNegative: boolean;
}

export async function getRepConfig(guildId: string): Promise<ReputationConfig> {
  const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'reputation');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
  return {
    defaultRep: config?.defaultRep ?? 0,
    giveCooldown: config?.giveCooldown ?? 3600, // 1 hour
    globalCooldown: config?.globalCooldown ?? 60, // 1 minute
    dailyLimit: config?.dailyLimit ?? 5,
    decayEnabled: config?.decayEnabled ?? false,
    decayAfterDays: config?.decayAfterDays ?? 30,
    decayAmount: config?.decayAmount ?? 1,
    decayFloor: config?.decayFloor ?? 0,
    upvoteEmoji: config?.upvoteEmoji ?? '⬆️',
    downvoteEmoji: config?.downvoteEmoji ?? '⬇️',
    reactionRepEnabled: config?.reactionRepEnabled ?? false,
    logChannelId: config?.logChannelId ?? null,
    allowSelfRep: config?.allowSelfRep ?? false,
    allowNegative: config?.allowNegative ?? false,
  };
}

// ============================================
// Rep CRUD
// ============================================

/**
 * Get a user's reputation in a guild.
 */
export async function getUserRep(guildId: string, userId: string): Promise<number> {
  const redis = getRedis();
  const cacheKey = `rep:${guildId}:${userId}`;

  const cached = await redis.get(cacheKey);
  if (cached !== null) return parseInt(cached, 10);

  const db = getDb();
  const result = await db.execute(sql`
    SELECT reputation FROM reputation_users
    WHERE guild_id = ${guildId} AND user_id = ${userId}
    LIMIT 1
  `);

  const row = (result as any).rows?.[0];
  const config = await getRepConfig(guildId);
  const rep = row ? row.reputation : config.defaultRep;

  await redis.setex(cacheKey, 600, rep.toString());
  return rep;
}

/**
 * Set a user's reputation to an exact value.
 */
export async function setUserRep(guildId: string, userId: string, amount: number): Promise<void> {
  const db = getDb();
  const redis = getRedis();

  await db.execute(sql`
    INSERT INTO reputation_users (guild_id, user_id, reputation, last_active)
    VALUES (${guildId}, ${userId}, ${amount}, ${Date.now()})
    ON CONFLICT (guild_id, user_id)
    DO UPDATE SET reputation = ${amount}, last_active = ${Date.now()}
  `);

  await redis.setex(`rep:${guildId}:${userId}`, 600, amount.toString());
}

/**
 * Adjust a user's reputation by a delta.
 */
export async function adjustRep(
  guildId: string,
  userId: string,
  delta: number,
  givenBy: string,
  reason?: string,
): Promise<{ newRep: number; oldRep: number }> {
  const db = getDb();
  const redis = getRedis();
  const config = await getRepConfig(guildId);

  const oldRep = await getUserRep(guildId, userId);
  let newRep = oldRep + delta;

  // Floor check
  if (!config.allowNegative && newRep < 0) {
    newRep = 0;
  }

  await db.execute(sql`
    INSERT INTO reputation_users (guild_id, user_id, reputation, last_active)
    VALUES (${guildId}, ${userId}, ${newRep}, ${Date.now()})
    ON CONFLICT (guild_id, user_id)
    DO UPDATE SET reputation = ${newRep}, last_active = ${Date.now()}
  `);

  // Log the change
  await db.execute(sql`
    INSERT INTO reputation_history (guild_id, user_id, given_by, delta, reason, created_at)
    VALUES (${guildId}, ${userId}, ${givenBy}, ${delta}, ${reason || null}, ${Date.now()})
  `);

  await redis.setex(`rep:${guildId}:${userId}`, 600, newRep.toString());

  // Emit event for cross-module integration
  eventBus.emit('reputationChanged', { guildId, userId, oldRep, newRep, reason: `Changed by ${givenBy}`, delta });

  return { newRep, oldRep };
}

/**
 * Reset a user's reputation to default.
 */
export async function resetUserRep(guildId: string, userId: string): Promise<void> {
  const config = await getRepConfig(guildId);
  await setUserRep(guildId, userId, config.defaultRep);

  const db = getDb();
  await db.execute(sql`
    DELETE FROM reputation_history WHERE guild_id = ${guildId} AND user_id = ${userId}
  `);
}

// ============================================
// Leaderboard
// ============================================

export interface RepLeaderboardEntry {
  userId: string;
  reputation: number;
  rank: number;
}

/**
 * Get the top N reputation holders.
 */
export async function getRepLeaderboard(guildId: string, limit: number = 10): Promise<RepLeaderboardEntry[]> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT user_id, reputation,
           ROW_NUMBER() OVER (ORDER BY reputation DESC) as rank
    FROM reputation_users
    WHERE guild_id = ${guildId}
    ORDER BY reputation DESC
    LIMIT ${limit}
  `);

  return ((result as any).rows || []).map((row: any) => ({
    userId: row.userId,
    reputation: row.reputation,
    rank: parseInt(row.rank, 10),
  }));
}

/**
 * Get a user's rank.
 */
export async function getUserRank(guildId: string, userId: string): Promise<number> {
  const db = getDb();
  const rep = await getUserRep(guildId, userId);

  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM reputation_users
    WHERE guild_id = ${guildId} AND reputation > ${rep}
  `);

  const count = parseInt((result as any).rows?.[0]?.count || '0', 10);
  return count + 1;
}

// ============================================
// History
// ============================================

export interface RepHistoryEntry {
  userId: string;
  givenBy: string;
  delta: number;
  reason: string | null;
  createdAt: number;
}

/**
 * Get reputation history for a user.
 */
export async function getRepHistory(guildId: string, userId: string, limit: number = 20): Promise<RepHistoryEntry[]> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT user_id, given_by, delta, reason, created_at
    FROM reputation_history
    WHERE guild_id = ${guildId} AND user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  return ((result as any).rows || []).map((row: any) => ({
    userId: row.userId,
    givenBy: row.given_by,
    delta: row.delta,
    reason: row.reason,
    createdAt: row.createdAt,
  }));
}

// ============================================
// Cooldowns
// ============================================

/**
 * Check if a user can give rep (respects both target-specific and global cooldowns).
 */
export async function canGiveRep(guildId: string, giverId: string, targetId: string): Promise<{ allowed: boolean; remaining?: number }> {
  const redis = getRedis();
  const config = await getRepConfig(guildId);

  // Check target-specific cooldown
  const targetKey = `rep:cd:${guildId}:${giverId}:${targetId}`;
  const targetTtl = await redis.ttl(targetKey);
  if (targetTtl > 0) {
    return { allowed: false, remaining: targetTtl };
  }

  // Check global cooldown
  const globalKey = `rep:cd:${guildId}:${giverId}:global`;
  const globalTtl = await redis.ttl(globalKey);
  if (globalTtl > 0) {
    return { allowed: false, remaining: globalTtl };
  }

  // Check daily limit
  const dailyKey = `rep:daily:${guildId}:${giverId}`;
  const dailyCount = parseInt(await redis.get(dailyKey) || '0', 10);
  if (dailyCount >= config.dailyLimit) {
    return { allowed: false, remaining: await redis.ttl(dailyKey) };
  }

  return { allowed: true };
}

/**
 * Set cooldowns after giving rep.
 */
export async function setRepCooldowns(guildId: string, giverId: string, targetId: string): Promise<void> {
  const redis = getRedis();
  const config = await getRepConfig(guildId);

  // Target-specific cooldown
  await redis.setex(`rep:cd:${guildId}:${giverId}:${targetId}`, config.giveCooldown, '1');

  // Global cooldown
  if (config.globalCooldown > 0) {
    await redis.setex(`rep:cd:${guildId}:${giverId}:global`, config.globalCooldown, '1');
  }

  // Daily counter
  const dailyKey = `rep:daily:${guildId}:${giverId}`;
  const exists = await redis.exists(dailyKey);
  await redis.incr(dailyKey);
  if (!exists) {
    // Expire at midnight UTC
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    const ttl = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
    await redis.expire(dailyKey, ttl);
  }
}

// ============================================
// Rep-Gated Roles
// ============================================

export interface RepRole {
  id: number;
  guildId: string;
  roleId: string;
  requiredRep: number;
  removeOnDrop: boolean;
}

/**
 * Get all rep-gated roles for a guild, sorted by required rep ascending.
 */
export async function getRepRoles(guildId: string): Promise<RepRole[]> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT id, guild_id, role_id, required_rep, remove_on_drop
    FROM reputation_roles
    WHERE guild_id = ${guildId}
    ORDER BY required_rep ASC
  `);

  return ((result as any).rows || []).map((row: any) => ({
    id: row.id,
    guildId: row.guildId,
    roleId: row.role_id,
    requiredRep: row.required_rep,
    removeOnDrop: row.remove_on_drop,
  }));
}

/**
 * Add a rep-gated role.
 */
export async function addRepRole(
  guildId: string,
  roleId: string,
  requiredRep: number,
  removeOnDrop: boolean,
): Promise<RepRole> {
  const db = getDb();
  const result = await db.execute(sql`
    INSERT INTO reputation_roles (guild_id, role_id, required_rep, remove_on_drop)
    VALUES (${guildId}, ${roleId}, ${requiredRep}, ${removeOnDrop})
    ON CONFLICT (guild_id, role_id)
    DO UPDATE SET required_rep = ${requiredRep}, remove_on_drop = ${removeOnDrop}
    RETURNING id, guild_id, role_id, required_rep, remove_on_drop
  `);

  return {
    id: (result as any).rows[0].id,
    guildId,
    roleId,
    requiredRep,
    removeOnDrop,
  };
}

/**
 * Remove a rep-gated role.
 */
export async function removeRepRole(guildId: string, roleId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.execute(sql`
    DELETE FROM reputation_roles WHERE guild_id = ${guildId} AND role_id = ${roleId}
  `);
  return (result as any).rowCount > 0;
}

/**
 * Check and update rep-gated roles for a member.
 */
export async function updateRepRoles(guild: Guild, userId: string, newRep: number): Promise<void> {
  const repRoles = await getRepRoles(guild.id);
  if (repRoles.length === 0) return;

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  for (const rr of repRoles) {
    const role = guild.roles.cache.get(rr.roleId);
    if (!role) continue;

    const hasRole = member.roles.cache.has(rr.roleId);
    const qualifies = newRep >= rr.requiredRep;

    if (qualifies && !hasRole) {
      try {
        await member.roles.add(role, `Rep role: reached ${rr.requiredRep} rep`);
      } catch (err: any) {
        logger.debug('Failed to add rep role', { error: err.message });
      }
    } else if (!qualifies && hasRole && rr.removeOnDrop) {
      try {
        await member.roles.remove(role, `Rep role: dropped below ${rr.requiredRep} rep`);
      } catch (err: any) {
        logger.debug('Failed to remove rep role', { error: err.message });
      }
    }
  }
}

// ============================================
// Decay
// ============================================

/**
 * Process reputation decay for a guild.
 */
export async function processDecay(guild: Guild): Promise<number> {
  const config = await getRepConfig(guild.id);
  if (!config.decayEnabled) return 0;

  const db = getDb();
  const cutoff = Date.now() - config.decayAfterDays * 24 * 60 * 60 * 1000;

  // Find users who haven't been active and have rep above the floor
  const result = await db.execute(sql`
    UPDATE reputation_users
    SET reputation = GREATEST(reputation - ${config.decayAmount}, ${config.decayFloor})
    WHERE guild_id = ${guild.id}
      AND last_active < ${cutoff}
      AND reputation > ${config.decayFloor}
    RETURNING user_id, reputation
  `);

  const rows = (result as any).rows || [];

  // Update rep roles for decayed users
  for (const row of rows) {
    await updateRepRoles(guild, row.userId, row.reputation);
    const redis = getRedis();
    await redis.setex(`rep:${guild.id}:${row.userId}`, 600, row.reputation.toString());
  }

  return rows.length;
}

// ============================================
// Formatting
// ============================================

/**
 * Format a reputation delta with sign and emoji.
 */
export function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta} ⬆️`;
  if (delta < 0) return `${delta} ⬇️`;
  return '0';
}

/**
 * Format a timestamp to a relative Discord timestamp.
 */
export function relativeTimestamp(ms: number): string {
  return `<t:${Math.floor(ms / 1000)}:R>`;
}
