import { Router, Request, Response } from 'express';
import { getDb } from '../../database/connection';
import { users, guildMembers } from '../../database/models/schema';
import { eq, and } from 'drizzle-orm';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('UsersAPI');
const router = Router();

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

    const members = await db.select()
      .from(guildMembers)
      .where(eq(guildMembers.guildId, guildId))
      .orderBy(orderColumn)
      .limit(limit)
      .offset(offset);

    // Reverse for descending (drizzle doesn't have .desc() on select)
    members.reverse();

    res.json({
      leaderboard: members,
      page,
      limit,
    });
  } catch (err: any) {
    logger.error('Get leaderboard error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

export { router as usersRouter };
