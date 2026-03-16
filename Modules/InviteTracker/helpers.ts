import { Guild, GuildMember } from 'discord.js';
import { getPool } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { eventBus } from '../../Shared/src/events/eventBus';

const pool = getPool();

export interface InviteConfig {
  enabled: boolean;
  trackJoins: boolean;
  trackLeaves: boolean;
  trackFakes: boolean;
  fakeAccountAgeDays: number;
  fakeLeaveHours: number;
  logChannelId?: string;
  announceJoins: boolean;
  announceChannelId?: string;
}

export interface InviteData {
  usedId: string;
  inviterId: string;
  guildId: string;
  code: string;
  joinedAt: Date;
  leftAt?: Date;
  isFake: boolean;
}

export interface InviterStats {
  total: number;
  leaves: number;
  fakes: number;
  bonus: number;
  real: number;
}

const DEFAULT_CONFIG: InviteConfig = {
  enabled: true,
  trackJoins: true,
  trackLeaves: true,
  trackFakes: true,
  fakeAccountAgeDays: 7,
  fakeLeaveHours: 24,
  announceJoins: false,
};

/**
 * Get invite config with defaults
 */
export async function getInviteConfig(guildId: string): Promise<InviteConfig> {
  const cached = cache.get<InviteConfig>(`inviteconfig:${guildId}`);
  if (cached) return cached;

  const result = await pool.query(
    `SELECT config FROM guild_settings WHERE guild_id = $1`,
    [guildId]
  );

  let config = DEFAULT_CONFIG;
  if (result.rows.length > 0 && result.rows[0].config?.invitetracker) {
    config = { ...DEFAULT_CONFIG, ...result.rows[0].config.invitetracker };
  }

  cache.set(`inviteconfig:${guildId}`, config, 3600);
  return config;
}

/**
 * Cache all current invite uses in Redis
 */
export async function cacheGuildInvites(guild: Guild): Promise<void> {
  try {
    const invites = await guild.invites.fetch();
    for (const invite of invites.values()) {
      const key = `invites:cache:${guild.id}:${invite.code}`;
      cache.set(key, invite.uses?.toString() || '0');
    }
  } catch (error) {
    console.error(`Failed to cache invites for guild ${guild.id}:`, error);
  }
}

/**
 * Find which invite code was used by comparing cached vs current
 */
export async function findUsedInvite(guild: Guild): Promise<string | null> {
  try {
    const currentInvites = await guild.invites.fetch();

    for (const invite of currentInvites.values()) {
      const cacheKey = `invites:cache:${guild.id}:${invite.code}`;
      const cachedUses = cache.get<string>(cacheKey);
      const currentUses = invite.uses || 0;
      const previousUses = parseInt(cachedUses || '0', 10);

      if (currentUses > previousUses) {
        cache.set(cacheKey, currentUses.toString());
        return invite.code;
      }
    }
  } catch (error) {
    console.error(`Failed to find used invite for guild ${guild.id}:`, error);
  }

  return null;
}

/**
 * Record a new invite
 */
export async function recordInvite(
  guildId: string,
  inviterId: string,
  joinedUserId: string,
  code: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO invite_records (guild_id, inviter_id, user_id, code, joined_at, is_fake)
       VALUES ($1, $2, $3, $4, NOW(), false)`,
      [guildId, inviterId, joinedUserId, code]
    );

    await pool.query(
      `UPDATE guild_members SET invited_by = $1 WHERE guild_id = $2 AND user_id = $3`,
      [inviterId, guildId, joinedUserId]
    );

    await pool.query(
      `UPDATE guild_members
       SET invites = COALESCE(invites, 0) + 1
       WHERE guild_id = $1 AND user_id = $2`,
      [guildId, inviterId]
    );

    cache.del(`inviterstats:${guildId}:${inviterId}`);
    cache.del(`guildinvites:${guildId}`);

    eventBus.emit('inviteTracked', {
      guildId,
      inviterId,
      invitedId: joinedUserId,
      code,
    });
  } catch (error) {
    console.error('Failed to record invite:', error);
  }
}

/**
 * Record a user leaving
 */
export async function recordLeave(guildId: string, userId: string): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT inviter_id, is_fake FROM invite_records
       WHERE guild_id = $1 AND user_id = $2 AND left_at IS NULL
       ORDER BY joined_at DESC LIMIT 1`,
      [guildId, userId]
    );

    if (result.rows.length === 0) return;

    const { inviter_id, is_fake } = result.rows[0];

    await pool.query(
      `UPDATE invite_records SET left_at = NOW()
       WHERE guild_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [guildId, userId]
    );

    if (!is_fake) {
      await pool.query(
        `UPDATE guild_members SET invites = GREATEST(COALESCE(invites, 0) - 1, 0)
         WHERE guild_id = $1 AND user_id = $2`,
        [guildId, inviter_id]
      );
    }

    cache.del(`inviterstats:${guildId}:${inviter_id}`);
    cache.del(`guildinvites:${guildId}`);

    eventBus.emit('inviteLeft', {
      guildId,
      inviterId: inviter_id,
      userId,
    });
  } catch (error) {
    console.error('Failed to record leave:', error);
  }
}

/**
 * Check if an account is fake based on age
 */
export async function checkFakeInvite(
  member: GuildMember,
  config: InviteConfig
): Promise<boolean> {
  const accountAge = Date.now() - member.user.createdTimestamp;
  const ageInDays = accountAge / (1000 * 60 * 60 * 24);
  return ageInDays < config.fakeAccountAgeDays;
}

/**
 * Mark an invite as fake and adjust counts
 */
export async function markInviteAsFake(
  guildId: string,
  userId: string
): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT inviter_id FROM invite_records
       WHERE guild_id = $1 AND user_id = $2 AND left_at IS NULL AND NOT is_fake
       ORDER BY joined_at DESC LIMIT 1`,
      [guildId, userId]
    );

    if (result.rows.length === 0) return;

    const inviterId = result.rows[0].inviter_id;

    await pool.query(
      `UPDATE invite_records SET is_fake = true
       WHERE guild_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [guildId, userId]
    );

    await pool.query(
      `UPDATE guild_members SET invites = GREATEST(COALESCE(invites, 0) - 1, 0)
       WHERE guild_id = $1 AND user_id = $2`,
      [guildId, inviterId]
    );

    cache.del(`inviterstats:${guildId}:${inviterId}`);
  } catch (error) {
    console.error('Failed to mark invite as fake:', error);
  }
}

/**
 * Get inviter stats
 */
export async function getInviterStats(
  guildId: string,
  userId: string
): Promise<InviterStats> {
  const cacheKey = `inviterstats:${guildId}:${userId}`;
  const cached = cache.get<InviterStats>(cacheKey);
  if (cached) return cached;

  const result = await pool.query(
    `SELECT
      COUNT(*) FILTER (WHERE left_at IS NULL AND NOT is_fake) as real_count,
      COUNT(*) FILTER (WHERE left_at IS NOT NULL) as leave_count,
      COUNT(*) FILTER (WHERE is_fake) as fake_count
     FROM invite_records
     WHERE guild_id = $1 AND inviter_id = $2`,
    [guildId, userId]
  );

  const memberResult = await pool.query(
    `SELECT invites, bonus_invites FROM guild_members
     WHERE guild_id = $1 AND user_id = $2`,
    [guildId, userId]
  );

  const total = parseInt(result.rows[0].real_count || '0', 10);
  const leaves = parseInt(result.rows[0].leave_count || '0', 10);
  const fakes = parseInt(result.rows[0].fake_count || '0', 10);
  const bonus = memberResult.rows.length > 0 ? (memberResult.rows[0].bonus_invites || 0) : 0;
  const real = total + bonus;

  const stats: InviterStats = { total, leaves, fakes, bonus, real };
  cache.set(cacheKey, stats, 3600);
  return stats;
}

/**
 * Get invites in a specific time period
 */
export async function getInviterStatsInPeriod(
  guildId: string,
  userId: string,
  days: number
): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count
     FROM invite_records
     WHERE guild_id = $1 AND inviter_id = $2
     AND joined_at >= NOW() - INTERVAL '1 day' * $3
     AND left_at IS NULL AND NOT is_fake`,
    [guildId, userId, days]
  );

  return parseInt(result.rows[0].count || '0', 10);
}

/**
 * Get who invited a user
 */
export async function getInvitedBy(
  guildId: string,
  userId: string
): Promise<{ inviterId: string; code: string; joinedAt: Date } | null> {
  const result = await pool.query(
    `SELECT inviter_id, code, joined_at FROM invite_records
     WHERE guild_id = $1 AND user_id = $2 AND left_at IS NULL
     ORDER BY joined_at DESC LIMIT 1`,
    [guildId, userId]
  );

  if (result.rows.length === 0) return null;

  return {
    inviterId: result.rows[0].inviter_id,
    code: result.rows[0].code,
    joinedAt: result.rows[0].joined_at,
  };
}

export interface TopInviter {
  userId: string;
  count: number;
}

/**
 * Get top inviters for leaderboard
 */
export async function getTopInviters(
  guildId: string,
  limit: number = 10,
  days?: number
): Promise<TopInviter[]> {
  let query = `
    SELECT inviter_id as user_id,
           COUNT(*) FILTER (WHERE NOT is_fake AND left_at IS NULL) as count
    FROM invite_records
    WHERE guild_id = $1
  `;
  const params: (string | number)[] = [guildId];

  if (days) {
    query += ` AND joined_at >= NOW() - INTERVAL '1 day' * $2`;
    params.push(days);
  }

  query += `
    GROUP BY inviter_id
    ORDER BY count DESC
    LIMIT $${params.length + 1}
  `;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows.map((row: any) => ({
    userId: row.user_id,
    count: parseInt(row.count, 10),
  }));
}

/**
 * Add bonus invites
 */
export async function addBonusInvites(
  guildId: string,
  userId: string,
  count: number,
  addedBy: string
): Promise<void> {
  await pool.query(
    `UPDATE guild_members
     SET bonus_invites = COALESCE(bonus_invites, 0) + $1
     WHERE guild_id = $2 AND user_id = $3`,
    [count, guildId, userId]
  );

  cache.del(`inviterstats:${guildId}:${userId}`);
  eventBus.emit('bonusInvitesAdded', { guildId, userId, amount: count, addedBy });
}

/**
 * Remove bonus invites
 */
export async function removeBonusInvites(
  guildId: string,
  userId: string,
  count: number,
  removedBy: string
): Promise<void> {
  await pool.query(
    `UPDATE guild_members
     SET bonus_invites = GREATEST(COALESCE(bonus_invites, 0) - $1, 0)
     WHERE guild_id = $2 AND user_id = $3`,
    [count, guildId, userId]
  );

  cache.del(`inviterstats:${guildId}:${userId}`);
  eventBus.emit('bonusInvitesRemoved', { guildId, userId, amount: count, removedBy });
}

/**
 * Reset invites for user or guild
 */
export async function resetInvites(guildId: string, resetBy: string, userId?: string): Promise<void> {
  if (userId) {
    await pool.query(
      `DELETE FROM invite_records WHERE guild_id = $1 AND inviter_id = $2`,
      [guildId, userId]
    );
    await pool.query(
      `UPDATE guild_members SET invites = 0, bonus_invites = 0
       WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    cache.del(`inviterstats:${guildId}:${userId}`);
    eventBus.emit('invitesReset', { guildId, userId, resetBy });
  } else {
    await pool.query(`DELETE FROM invite_records WHERE guild_id = $1`, [guildId]);
    await pool.query(
      `UPDATE guild_members SET invites = 0, bonus_invites = 0
       WHERE guild_id = $1`,
      [guildId]
    );
    cache.del(`guildinvites:${guildId}`);
    eventBus.emit('invitesReset', { guildId, resetBy });
  }
}

/**
 * Build invites embed
 */
export function buildInvitesContainer(
  userId: string,
  stats: InviterStats,
  guild: Guild,
  days?: number
) {
  const { moduleContainer, addFields, v2Payload } = require('../../Shared/src/utils/componentsV2');
  const container = moduleContainer('invite_tracker');

  addFields(container, [
    { name: 'Real Invites', value: stats.real.toString(), inline: true },
    { name: 'Bonus Invites', value: stats.bonus.toString(), inline: true },
    { name: 'Total Invites', value: stats.total.toString(), inline: true },
    { name: 'Left', value: stats.leaves.toString(), inline: true },
    { name: 'Fake', value: stats.fakes.toString(), inline: true }
  ]);

  return v2Payload([container]);
}

/**
 * Build leaderboard embed
 */
export function buildLeaderboardContainer(
  entries: Array<{ userId: string; count: number }>,
  guildName: string,
  page: number = 1,
  days?: number
) {
  const { moduleContainer, addFields, v2Payload } = require('../../Shared/src/utils/componentsV2');
  const container = moduleContainer('invite_tracker');

  const medals = ['🥇', '🥈', '🥉'];
  const fields = entries.map((entry, index) => {
    const medal = index < 3 ? medals[index] : `${index + 1}.`;
    return {
      name: `${medal} <@${entry.userId}>`,
      value: `${entry.count} invites`,
      inline: true,
    };
  });

  addFields(container, fields);

  return v2Payload([container]);
}

/**
 * Log invite event
 */
export async function logInviteEvent(
  guild: Guild,
  config: InviteConfig,
  event: string,
  details: string
): Promise<void> {
  if (!config.logChannelId) return;

  try {
    const channel = await guild.channels.fetch(config.logChannelId);
    if (!channel || !channel.isTextBased()) return;

    const { moduleContainer, addText, v2Payload } = await import('../../Shared/src/utils/componentsV2');
    const container = moduleContainer('invite_tracker');
    addText(container, `### Invite Event: ${event}`);
    addText(container, details);

    await (channel as any).send(v2Payload([container]));
  } catch (error) {
    console.error(`Failed to log invite event in guild ${guild.id}:`, error);
  }
}
