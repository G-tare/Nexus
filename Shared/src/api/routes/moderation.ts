/**
 * Moderation & Safety API Routes
 *
 * Endpoints:
 *  GET    /api/owner/moderation/blocklist         — List blocked users
 *  POST   /api/owner/moderation/blocklist          — Block a user
 *  DELETE /api/owner/moderation/blocklist/:userId  — Unblock a user
 *  GET    /api/owner/moderation/overview           — Moderation overview stats
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('ModerationAPI');
export const moderationRouter = Router();

/* ── GET /blocklist — List blocked users ── */

moderationRouter.get('/blocklist', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const result = await pool.query(
      `SELECT user_id, reason, blocked_by, expires_at, blocked_at as created_at
       FROM user_blocklist
       WHERE expires_at IS NULL OR expires_at > NOW()
       ORDER BY blocked_at DESC
       LIMIT $1`,
      [limit],
    );

    const total = await pool.query(
      `SELECT COUNT(*) as count FROM user_blocklist
       WHERE expires_at IS NULL OR expires_at > NOW()`,
    );

    res.json({
      users: result.rows,
      total: parseInt(total.rows[0].count, 10),
    });
  } catch (err: any) {
    logger.error('Failed to get blocklist', { error: err.message });
    res.status(500).json({ error: 'Failed to get blocklist' });
  }
});

/* ── POST /blocklist — Block a user ── */

moderationRouter.post('/blocklist', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { userId, reason, expiresAt } = req.body as {
      userId?: string;
      reason?: string;
      expiresAt?: string;
    };

    if (!userId || !userId.match(/^\d{17,20}$/)) {
      res.status(400).json({ error: 'Valid userId is required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO user_blocklist (user_id, reason, blocked_by, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET reason = $2, blocked_by = $3, expires_at = $4, blocked_at = NOW()
       RETURNING user_id, reason, blocked_by, expires_at, blocked_at as created_at`,
      [userId, reason || 'No reason provided', (req as any).user?.id, expiresAt || null],
    );

    logger.info(`User blocked: ${userId}`, { by: (req as any).user?.id, reason });
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    logger.error('Failed to block user', { error: err.message });
    res.status(500).json({ error: 'Failed to block user' });
  }
});

/* ── DELETE /blocklist/:userId — Unblock a user ── */

moderationRouter.delete('/blocklist/:userId', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const userId = req.params.userId as string;

    const result = await pool.query(
      'DELETE FROM user_blocklist WHERE user_id = $1 RETURNING user_id',
      [userId],
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'User not found in blocklist' });
      return;
    }

    logger.info(`User unblocked: ${userId}`, { by: (req as any).user?.id });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Failed to unblock user', { error: err.message });
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

/* ── GET /overview — Moderation overview stats ── */

moderationRouter.get('/overview', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();

    const [blocklist, tickets, bans] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) as total
        FROM user_blocklist
        WHERE expires_at IS NULL OR expires_at > NOW()
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE category = 'appeal') as total_appeals,
          COUNT(*) FILTER (WHERE category = 'appeal' AND status = 'open') as open_appeals,
          COUNT(*) FILTER (WHERE category = 'bug') as total_bugs,
          COUNT(*) FILTER (WHERE category = 'bug' AND status = 'open') as open_bugs
        FROM bot_tickets
      `),
      pool.query(`
        SELECT COUNT(*) as count FROM server_module_bans
      `),
    ]);

    res.json({
      blockedUsers: parseInt(blocklist.rows[0].total, 10),
      appeals: tickets.rows[0],
      serverBans: parseInt(bans.rows[0].count, 10),
    });
  } catch (err: any) {
    logger.error('Failed to get moderation overview', { error: err.message });
    res.status(500).json({ error: 'Failed to get moderation overview' });
  }
});
