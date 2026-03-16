import { GuildMember } from 'discord.js';
import { getDb } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { sql } from 'drizzle-orm';

const logger = createModuleLogger('ActivityTracking');

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ActivityConfig {
  enabled: boolean;
  trackVoice: boolean;
  trackMessages: boolean;
  trackReactions: boolean;
  inactiveThresholdDays: number;
  logChannelId: string | null;
  excludedChannels: string[];
  excludedRoles: string[];
  resetOnLeave: boolean;
  leaderboardSize: number;
}

export const defaultActivityConfig: ActivityConfig = {
  enabled: true,
  trackVoice: true,
  trackMessages: true,
  trackReactions: true,
  inactiveThresholdDays: 30,
  logChannelId: null,
  excludedChannels: [],
  excludedRoles: [],
  resetOnLeave: false,
  leaderboardSize: 10,
};

export interface ActivityLeaderboardEntry {
  userId: string;
  score: number;
  voiceMinutes: number;
  messages: number;
  reactions: number;
}

export interface UserActivityBreakdown {
  voiceMinutes: number;
  messages: number;
  reactions: number;
  score: number;
  rank: number | null;
}

// ── Config ──────────────────────────────────────────────────────────────────

export async function getActivityConfig(guildId: string): Promise<ActivityConfig> {
  try {
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'activitytracking');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
    return { ...defaultActivityConfig, ...config };
  } catch {
    return defaultActivityConfig;
  }
}

export async function updateActivityConfig(guildId: string, updates: Partial<ActivityConfig>): Promise<ActivityConfig> {
  const current = await getActivityConfig(guildId);
  const updated = { ...current, ...updates };
  await moduleConfig.updateConfig(guildId, 'activitytracking', updated);
  logger.info(`Activity config updated for guild ${guildId}`);
  return updated;
}

// ── Voice Session Tracking ──────────────────────────────────────────────────

export async function startVoiceSession(guildId: string, userId: string, channelId: string): Promise<void> {
  const sessionKey = `activity:voice:${guildId}:${userId}`;
  const startTime = Date.now();

  cache.set(sessionKey, { channelId, startTime }, 86400 * 7);
  logger.debug(`Voice session started for ${userId} in guild ${guildId}`);
}

export async function endVoiceSession(guildId: string, userId: string): Promise<number> {
  const sessionKey = `activity:voice:${guildId}:${userId}`;

  const sessionData = cache.get<{ channelId: string; startTime: number }>(sessionKey);
  if (!sessionData) {
    return 0;
  }

  const duration = Math.max(1, Math.floor((Date.now() - sessionData.startTime) / 60000));

  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  try {
    await db.execute(sql`
      INSERT INTO activity_tracking (guild_id, user_id, date, voice_minutes, message_count, reaction_count)
      VALUES (${guildId}, ${userId}, ${today}, ${duration}, 0, 0)
      ON CONFLICT (guild_id, user_id, date) DO UPDATE SET
        voice_minutes = activity_tracking.voice_minutes + ${duration}
    `);

    cache.del(sessionKey);
    logger.debug(`Voice session ended for ${userId} in guild ${guildId}: ${duration} minutes`);

    emitActivityUpdate(guildId, userId, 'voice');
  } catch (error) {
    logger.error(`Failed to record voice session:`, error);
  }

  return duration;
}

// ── Message & Reaction Tracking ─────────────────────────────────────────────

export async function incrementMessageActivity(guildId: string, userId: string): Promise<void> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  try {
    await db.execute(sql`
      INSERT INTO activity_tracking (guild_id, user_id, date, voice_minutes, message_count, reaction_count)
      VALUES (${guildId}, ${userId}, ${today}, 0, 1, 0)
      ON CONFLICT (guild_id, user_id, date) DO UPDATE SET
        message_count = activity_tracking.message_count + 1
    `);

    emitActivityUpdate(guildId, userId, 'message');
  } catch (error) {
    logger.error(`Failed to record message activity:`, error);
  }
}

export async function incrementReactionActivity(guildId: string, userId: string): Promise<void> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  try {
    await db.execute(sql`
      INSERT INTO activity_tracking (guild_id, user_id, date, voice_minutes, message_count, reaction_count)
      VALUES (${guildId}, ${userId}, ${today}, 0, 0, 1)
      ON CONFLICT (guild_id, user_id, date) DO UPDATE SET
        reaction_count = activity_tracking.reaction_count + 1
    `);

    emitActivityUpdate(guildId, userId, 'reaction');
  } catch (error) {
    logger.error(`Failed to record reaction activity:`, error);
  }
}

// ── Scoring & Lookups ───────────────────────────────────────────────────────

export async function getActivityScore(guildId: string, userId: string, days: number = 30): Promise<number> {
  const breakdown = await getUserActivityBreakdown(guildId, userId, days);
  return breakdown.score;
}

export async function getUserActivityBreakdown(guildId: string, userId: string, days: number = 30): Promise<UserActivityBreakdown> {
  const db = getDb();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(voice_minutes), 0) as total_voice,
        COALESCE(SUM(message_count), 0) as total_messages,
        COALESCE(SUM(reaction_count), 0) as total_reactions
      FROM activity_tracking
      WHERE guild_id = ${guildId} AND user_id = ${userId} AND date >= ${startDateStr}
    `);

    const row = result.rows[0] as any;
    const voiceMinutes = Number(row?.total_voice || 0);
    const messages = Number(row?.total_messages || 0);
    const reactions = Number(row?.total_reactions || 0);

    const score = Math.floor(voiceMinutes / 10) + messages * 2 + Math.floor(reactions * 0.5);

    // Get rank — try activity leaderboard first, fall back to guild_members if no activity data
    const leaderboard = await getActivityLeaderboard(guildId, 1000, days);
    let rank: number | null = null;

    if (leaderboard.length > 0) {
      const rankIndex = leaderboard.findIndex((entry) => entry.userId === userId);
      rank = rankIndex >= 0 ? rankIndex + 1 : null;
    }

    // If no rank found (user not in leaderboard), fall back to counting guild members
    if (rank === null) {
      const memberCountResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM guild_members WHERE guild_id = ${guildId}
      `);
      const memberRow = (memberCountResult as any).rows?.[0] ?? (memberCountResult as any)[0];
      const totalMembers = Number(memberRow?.total || 0);
      // User exists but has no tracked activity yet — rank them last among members
      rank = totalMembers > 0 ? totalMembers : 1;
    }

    return {
      voiceMinutes,
      messages,
      reactions,
      score,
      rank,
    };
  } catch (error) {
    logger.error(`Failed to get activity breakdown for ${userId}:`, error);
    return { voiceMinutes: 0, messages: 0, reactions: 0, score: 0, rank: null };
  }
}

export async function getActivityLeaderboard(guildId: string, limit: number = 10, days: number = 30): Promise<ActivityLeaderboardEntry[]> {
  const db = getDb();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  try {
    const result = await db.execute(sql`
      SELECT
        user_id,
        COALESCE(SUM(voice_minutes), 0) as total_voice,
        COALESCE(SUM(message_count), 0) as total_messages,
        COALESCE(SUM(reaction_count), 0) as total_reactions
      FROM activity_tracking
      WHERE guild_id = ${guildId} AND date >= ${startDateStr}
      GROUP BY user_id
      ORDER BY (COALESCE(SUM(message_count), 0) * 2 + COALESCE(SUM(voice_minutes), 0) / 10 + COALESCE(SUM(reaction_count), 0) / 2) DESC
      LIMIT ${limit}
    `);

    return result.rows.map((row: any) => {
      const voiceMinutes = Number(row.total_voice || 0);
      const messages = Number(row.total_messages || 0);
      const reactions = Number(row.total_reactions || 0);
      const score = Math.floor(voiceMinutes / 10) + messages * 2 + Math.floor(reactions * 0.5);

      return { userId: row.user_id, score, voiceMinutes, messages, reactions };
    });
  } catch (error) {
    logger.error(`Failed to get leaderboard:`, error);
    return [];
  }
}

export async function getInactiveMembers(guildId: string, thresholdDays: number = 30): Promise<string[]> {
  const db = getDb();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - thresholdDays);
  const startDateStr = startDate.toISOString().split('T')[0];

  try {
    const result = await db.execute(sql`
      SELECT DISTINCT user_id
      FROM activity_tracking
      WHERE guild_id = ${guildId} AND date >= ${startDateStr}
    `);

    return result.rows.map((row: any) => row.user_id);
  } catch (error) {
    logger.error(`Failed to get inactive members:`, error);
    return [];
  }
}

// ── Exclusion Checks ────────────────────────────────────────────────────────

export function isExcluded(config: ActivityConfig, channelId: string, member: GuildMember): boolean {
  if (config.excludedChannels.includes(channelId)) return true;
  for (const roleId of config.excludedRoles) {
    if (member.roles.cache.has(roleId)) return true;
  }
  return false;
}

// ── EventBus Integration ────────────────────────────────────────────────────

export function emitActivityUpdate(guildId: string, userId: string, type: string): void {
  eventBus.emit('activityTracking:update', { guildId, userId, type, data: {}, timestamp: new Date() });
}

// ── Formatting Helpers ──────────────────────────────────────────────────────

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}
