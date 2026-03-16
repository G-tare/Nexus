/**
 * Command Usage Analytics API Routes — Owner dashboard endpoints for command analytics.
 *
 * All routes require owner authentication (authMiddleware + ownerMiddleware).
 *
 * Endpoints:
 *  GET /api/owner/commands/top          — Top commands by usage count
 *  GET /api/owner/commands/modules      — Usage breakdown by module
 *  GET /api/owner/commands/timeline     — Usage over time (hourly/daily)
 *  GET /api/owner/commands/peak-hours   — Peak usage hours heatmap
 *  GET /api/owner/commands/users        — DAU/WAU/MAU active user counts
 *  GET /api/owner/commands/performance  — Average execution times
 *  GET /api/owner/commands/errors       — Error rate by command
 *  GET /api/owner/commands/recent       — Recent command executions
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('CommandUsageAPI');
export const commandUsageRouter = Router();

/* ── Helper: parse date range params ── */

function parseDateRange(req: Request): { from: string; to: string } {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const from = (req.query.from as string) || defaultFrom.toISOString();
  const to = (req.query.to as string) || now.toISOString();
  return { from, to };
}

/* ── GET /top — Top commands by usage count ── */

commandUsageRouter.get('/top', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { from, to } = parseDateRange(req);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 25));
    const moduleFilter = req.query.module as string | undefined;

    const conditions = ['timestamp >= $1', 'timestamp <= $2'];
    const params: (string | number)[] = [from, to];
    let paramIdx = 3;

    if (moduleFilter) {
      conditions.push(`module_name = $${paramIdx++}`);
      params.push(moduleFilter);
    }

    const where = conditions.join(' AND ');

    const result = await pool.query(
      `SELECT
         command_name,
         subcommand_name,
         module_name,
         COUNT(*) as total_uses,
         COUNT(*) FILTER (WHERE success = true) as success_count,
         COUNT(*) FILTER (WHERE success = false) as error_count,
         ROUND(AVG(execution_ms)) as avg_ms,
         COUNT(DISTINCT user_id) as unique_users,
         COUNT(DISTINCT guild_id) as unique_guilds
       FROM command_usage
       WHERE ${where}
       GROUP BY command_name, subcommand_name, module_name
       ORDER BY total_uses DESC
       LIMIT $${paramIdx}`,
      [...params, limit],
    );

    res.json({ commands: result.rows });
  } catch (err: any) {
    logger.error('Failed to get top commands', { error: err.message });
    res.status(500).json({ error: 'Failed to get top commands' });
  }
});

/* ── GET /modules — Usage breakdown by module ── */

commandUsageRouter.get('/modules', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { from, to } = parseDateRange(req);

    const result = await pool.query(
      `SELECT
         module_name,
         COUNT(*) as total_uses,
         COUNT(*) FILTER (WHERE success = true) as success_count,
         COUNT(*) FILTER (WHERE success = false) as error_count,
         COUNT(DISTINCT command_name) as unique_commands,
         COUNT(DISTINCT user_id) as unique_users,
         COUNT(DISTINCT guild_id) as unique_guilds,
         ROUND(AVG(execution_ms)) as avg_ms
       FROM command_usage
       WHERE timestamp >= $1 AND timestamp <= $2
       GROUP BY module_name
       ORDER BY total_uses DESC`,
      [from, to],
    );

    res.json({ modules: result.rows });
  } catch (err: any) {
    logger.error('Failed to get module usage', { error: err.message });
    res.status(500).json({ error: 'Failed to get module usage' });
  }
});

/* ── GET /timeline — Usage over time ── */

commandUsageRouter.get('/timeline', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { from, to } = parseDateRange(req);
    const granularity = (req.query.granularity as string) || 'day';

    let truncExpr: string;
    switch (granularity) {
      case 'hour':
        truncExpr = "date_trunc('hour', timestamp)";
        break;
      case 'week':
        truncExpr = "date_trunc('week', timestamp)";
        break;
      default:
        truncExpr = "date_trunc('day', timestamp)";
    }

    const result = await pool.query(
      `SELECT
         ${truncExpr} as period,
         COUNT(*) as total_uses,
         COUNT(*) FILTER (WHERE success = true) as success_count,
         COUNT(*) FILTER (WHERE success = false) as error_count,
         COUNT(DISTINCT user_id) as unique_users,
         COUNT(DISTINCT guild_id) as active_guilds
       FROM command_usage
       WHERE timestamp >= $1 AND timestamp <= $2
       GROUP BY period
       ORDER BY period ASC`,
      [from, to],
    );

    res.json({ timeline: result.rows, granularity });
  } catch (err: any) {
    logger.error('Failed to get usage timeline', { error: err.message });
    res.status(500).json({ error: 'Failed to get usage timeline' });
  }
});

/* ── GET /peak-hours — Peak usage hours heatmap data ── */

commandUsageRouter.get('/peak-hours', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { from, to } = parseDateRange(req);

    const result = await pool.query(
      `SELECT
         EXTRACT(DOW FROM timestamp)::int as day_of_week,
         EXTRACT(HOUR FROM timestamp)::int as hour,
         COUNT(*) as count
       FROM command_usage
       WHERE timestamp >= $1 AND timestamp <= $2
       GROUP BY day_of_week, hour
       ORDER BY day_of_week, hour`,
      [from, to],
    );

    res.json({ heatmap: result.rows });
  } catch (err: any) {
    logger.error('Failed to get peak hours', { error: err.message });
    res.status(500).json({ error: 'Failed to get peak hours' });
  }
});

/* ── GET /users — DAU/WAU/MAU active user counts ── */

commandUsageRouter.get('/users', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        COUNT(DISTINCT user_id) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as dau,
        COUNT(DISTINCT user_id) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days') as wau,
        COUNT(DISTINCT user_id) FILTER (WHERE timestamp > NOW() - INTERVAL '30 days') as mau,
        COUNT(DISTINCT guild_id) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as daily_active_guilds,
        COUNT(DISTINCT guild_id) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days') as weekly_active_guilds,
        COUNT(DISTINCT guild_id) FILTER (WHERE timestamp > NOW() - INTERVAL '30 days') as monthly_active_guilds,
        COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as commands_24h,
        COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days') as commands_7d,
        COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '30 days') as commands_30d
      FROM command_usage
    `);

    res.json(result.rows[0]);
  } catch (err: any) {
    logger.error('Failed to get user stats', { error: err.message });
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

/* ── GET /performance — Average execution times by command ── */

commandUsageRouter.get('/performance', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { from, to } = parseDateRange(req);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 25));

    const result = await pool.query(
      `SELECT
         command_name,
         subcommand_name,
         module_name,
         COUNT(*) as total_uses,
         ROUND(AVG(execution_ms)) as avg_ms,
         ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_ms)) as p50_ms,
         ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_ms)) as p95_ms,
         ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_ms)) as p99_ms,
         MIN(execution_ms) as min_ms,
         MAX(execution_ms) as max_ms
       FROM command_usage
       WHERE timestamp >= $1 AND timestamp <= $2 AND success = true
       GROUP BY command_name, subcommand_name, module_name
       HAVING COUNT(*) >= 5
       ORDER BY avg_ms DESC
       LIMIT $3`,
      [from, to, limit],
    );

    res.json({ commands: result.rows });
  } catch (err: any) {
    logger.error('Failed to get performance data', { error: err.message });
    res.status(500).json({ error: 'Failed to get performance data' });
  }
});

/* ── GET /errors — Error rate by command ── */

commandUsageRouter.get('/errors', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { from, to } = parseDateRange(req);

    const result = await pool.query(
      `SELECT
         command_name,
         subcommand_name,
         module_name,
         COUNT(*) as total_uses,
         COUNT(*) FILTER (WHERE success = false) as error_count,
         ROUND(100.0 * COUNT(*) FILTER (WHERE success = false) / NULLIF(COUNT(*), 0), 2) as error_rate
       FROM command_usage
       WHERE timestamp >= $1 AND timestamp <= $2
       GROUP BY command_name, subcommand_name, module_name
       HAVING COUNT(*) FILTER (WHERE success = false) > 0
       ORDER BY error_count DESC
       LIMIT 50`,
      [from, to],
    );

    res.json({ commands: result.rows });
  } catch (err: any) {
    logger.error('Failed to get error data', { error: err.message });
    res.status(500).json({ error: 'Failed to get error data' });
  }
});

/* ── GET /recent — Recent command executions ── */

commandUsageRouter.get('/recent', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const result = await pool.query(
      `SELECT
         id, guild_id, user_id, module_name, command_name, subcommand_name,
         execution_ms, success, timestamp
       FROM command_usage
       ORDER BY timestamp DESC
       LIMIT $1`,
      [limit],
    );

    res.json({ executions: result.rows });
  } catch (err: any) {
    logger.error('Failed to get recent executions', { error: err.message });
    res.status(500).json({ error: 'Failed to get recent executions' });
  }
});
