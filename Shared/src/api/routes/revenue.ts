/**
 * Revenue & Premium Analytics API Routes
 *
 * Endpoints:
 *  GET /api/owner/revenue/overview   — Premium stats by tier, MRR, totals
 *  GET /api/owner/revenue/expiring   — Subscriptions expiring soon
 *  GET /api/owner/revenue/history    — Premium subscription history
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('RevenueAPI');
export const revenueRouter = Router();

/* ── GET /overview — Premium tier breakdown ── */

revenueRouter.get('/overview', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();

    // Premium tier distribution
    const tierResult = await pool.query(`
      SELECT
        premium_tier as tier,
        COUNT(*) as count
      FROM guilds
      GROUP BY premium_tier
      ORDER BY
        CASE premium_tier
          WHEN 'free' THEN 0 WHEN 'pro' THEN 1
          WHEN 'plus' THEN 2 WHEN 'premium' THEN 3
        END
    `);

    // Active subscriptions breakdown
    const subResult = await pool.query(`
      SELECT
        tier,
        COUNT(*) as active_count,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_amount
      FROM premium_subscriptions
      WHERE status = 'active'
      GROUP BY tier
    `);

    // Recent changes (last 30 days)
    const changesResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active' AND created_at > NOW() - INTERVAL '30 days') as new_30d,
        COUNT(*) FILTER (WHERE status = 'cancelled' AND created_at > NOW() - INTERVAL '30 days') as cancelled_30d,
        COUNT(*) FILTER (WHERE status = 'expired' AND created_at > NOW() - INTERVAL '30 days') as expired_30d
      FROM premium_subscriptions
    `);

    // Total premium servers (non-free)
    const premiumCount = await pool.query(`
      SELECT COUNT(*) as count FROM guilds WHERE premium_tier != 'free'
    `);

    res.json({
      tiers: tierResult.rows,
      subscriptions: subResult.rows,
      changes: changesResult.rows[0],
      totalPremiumServers: parseInt(premiumCount.rows[0].count, 10),
    });
  } catch (err: any) {
    logger.error('Failed to get revenue overview', { error: err.message });
    res.status(500).json({ error: 'Failed to get revenue overview' });
  }
});

/* ── GET /expiring — Subscriptions expiring in next 30 days ── */

revenueRouter.get('/expiring', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string, 10) || 30));

    const result = await pool.query(
      `SELECT
         ps.guild_id, ps.tier, ps.amount, ps.expiry_date, ps.status,
         g.name as guild_name, g.member_count
       FROM premium_subscriptions ps
       LEFT JOIN guilds g ON g.id = ps.guild_id
       WHERE ps.status = 'active'
         AND ps.expiry_date IS NOT NULL
         AND ps.expiry_date <= NOW() + make_interval(days := $1)
       ORDER BY ps.expiry_date ASC
       LIMIT 50`,
      [days],
    );

    res.json({ expiring: result.rows });
  } catch (err: any) {
    logger.error('Failed to get expiring subscriptions', { error: err.message });
    res.status(500).json({ error: 'Failed to get expiring subscriptions' });
  }
});

/* ── GET /history — Premium change history ── */

revenueRouter.get('/history', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const result = await pool.query(
      `SELECT
         ps.id, ps.guild_id, ps.tier, ps.amount, ps.status,
         ps.start_date, ps.expiry_date, ps.created_at,
         g.name as guild_name
       FROM premium_subscriptions ps
       LEFT JOIN guilds g ON g.id = ps.guild_id
       ORDER BY ps.created_at DESC
       LIMIT $1`,
      [limit],
    );

    res.json({ history: result.rows });
  } catch (err: any) {
    logger.error('Failed to get revenue history', { error: err.message });
    res.status(500).json({ error: 'Failed to get revenue history' });
  }
});
