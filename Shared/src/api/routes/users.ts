import { Router, Request, Response } from 'express';
import axios from 'axios';
import { getDb } from '../../database/connection';
import { users, guildMembers } from '../../database/models/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { config } from '../../config';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('UsersAPI');
const router = Router();
const DISCORD_API = 'https://discord.com/api/v10';

const discordAxios = axios.create({
  baseURL: DISCORD_API,
  timeout: 10000,
  headers: { Authorization: `Bot ${config.discord.token}` },
});

/**
 * Resolve Discord member data for users missing username/avatar in our DB.
 * Fetches from Discord API and updates the users table for next time.
 */
async function resolveDiscordMembers(
  guildId: string,
  userIds: string[],
): Promise<Map<string, { username: string; avatarUrl: string | null }>> {
  const resolved = new Map<string, { username: string; avatarUrl: string | null }>();
  if (userIds.length === 0) return resolved;

  try {
    // Discord API: GET /guilds/{id}/members?limit=100 doesn't support filtering by IDs
    // So we'll fetch individual users for small batches, or use search for larger ones
    const fetchPromises = userIds.slice(0, 25).map(async (userId) => {
      try {
        const res = await discordAxios.get(`/guilds/${guildId}/members/${userId}`);
        const member = res.data;
        const user = member.user;
        const displayName = member.nick || user.global_name || user.username || 'Unknown';
        const avatar = user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
          : `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % 6n}.png`;

        resolved.set(userId, { username: displayName, avatarUrl: avatar });

        // Update the users table so we don't need to fetch again
        const db = getDb();
        await db.update(users)
          .set({
            username: user.username,
            globalName: user.global_name || null,
            avatarUrl: avatar,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
          .catch(() => {}); // Don't fail if user row doesn't exist
      } catch {
        // User may have left the guild — skip
      }
    });

    await Promise.allSettled(fetchPromises);
  } catch (err: any) {
    logger.error('Failed to resolve Discord members', { error: err.message });
  }

  return resolved;
}

/**
 * GET /api/users/:guildId/:userId
 * Get a user's data for a specific guild.
 */
router.get('/:guildId/:userId', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const userId = req.params.userId as string;
    const db = getDb();

    const [member] = await db.select()
      .from(guildMembers)
      .where(
        and(
          eq(guildMembers.guildId, guildId),
          eq(guildMembers.userId, userId)
        )
      )
      .limit(1);

    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!member && !user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: user || null, member: member || null });
  } catch (err: any) {
    logger.error('Get user error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/users/:guildId/leaderboard/:type
 * Get leaderboard for a guild.
 */
router.get('/:guildId/leaderboard/:type', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const type = req.params.type as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = (page - 1) * limit;
    const db = getDb();

    // Build query based on leaderboard type
    let orderColumn: any;
    switch (type) {
      case 'level':
      case 'xp':
        orderColumn = guildMembers.totalXp;
        break;
      case 'messages':
        orderColumn = guildMembers.totalMessages;
        break;
      case 'coins':
        orderColumn = guildMembers.coins;
        break;
      case 'voice':
        orderColumn = guildMembers.totalVoiceMinutes;
        break;
      case 'invites':
        orderColumn = guildMembers.inviteCount;
        break;
      case 'reputation':
        orderColumn = guildMembers.reputation;
        break;
      default:
        res.status(400).json({ error: 'Invalid leaderboard type' });
        return;
    }

    // Join with users table to get username and avatar
    const results = await db.select({
      id: guildMembers.id,
      guildId: guildMembers.guildId,
      userId: guildMembers.userId,
      xp: guildMembers.xp,
      level: guildMembers.level,
      totalXp: guildMembers.totalXp,
      prestige: guildMembers.prestige,
      coins: guildMembers.coins,
      gems: guildMembers.gems,
      eventTokens: guildMembers.eventTokens,
      totalMessages: guildMembers.totalMessages,
      totalVoiceMinutes: guildMembers.totalVoiceMinutes,
      dailyMessages: guildMembers.dailyMessages,
      dailyStreak: guildMembers.dailyStreak,
      inviteCount: guildMembers.inviteCount,
      inviteFakeCount: guildMembers.inviteFakeCount,
      inviteLeaveCount: guildMembers.inviteLeaveCount,
      reputation: guildMembers.reputation,
      warnCount: guildMembers.warnCount,
      isMuted: guildMembers.isMuted,
      joinedAt: guildMembers.joinedAt,
      lastActiveAt: guildMembers.lastActiveAt,
      // From users table
      username: users.username,
      globalName: users.globalName,
      avatarUrl: users.avatarUrl,
    })
      .from(guildMembers)
      .leftJoin(users, eq(guildMembers.userId, users.id))
      .where(eq(guildMembers.guildId, guildId))
      .orderBy(desc(orderColumn))
      .limit(limit)
      .offset(offset);

    // Find users missing display names and resolve from Discord API
    const missingIds = results
      .filter(r => !r.globalName && !r.username)
      .map(r => r.userId);

    const discordData = await resolveDiscordMembers(guildId, missingIds);

    res.json({
      leaderboard: results.map(r => {
        const discord = discordData.get(r.userId);
        return {
          ...r,
          username: r.globalName || r.username || discord?.username || null,
          avatarUrl: r.avatarUrl || discord?.avatarUrl || null,
        };
      }),
      page,
      limit,
    });
  } catch (err: any) {
    logger.error('Get leaderboard error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

export { router as usersRouter };
