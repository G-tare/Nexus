/**
 * Health & Performance API Routes — Bot health monitoring endpoints.
 *
 * Endpoints:
 *  GET /api/owner/health/overview    — Uptime, memory, basic health stats
 *  GET /api/owner/health/latency     — Command execution latency percentiles
 *  GET /api/owner/health/errors      — Recent error rates from command_usage
 *  GET /api/owner/health/resources   — Memory usage snapshot
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('HealthAPI');
export const healthRouter = Router();

const startTime = Date.now();

/* ── GET /overview — Basic health overview ── */

healthRouter.get('/overview', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const uptime = Date.now() - startTime;
    const mem = process.memoryUsage();

    // Recent command stats
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '1 hour') as commands_1h,
        COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as commands_24h,
        COUNT(*) FILTER (WHERE success = false AND timestamp > NOW() - INTERVAL '1 hour') as errors_1h,
        COUNT(*) FILTER (WHERE success = false AND timestamp > NOW() - INTERVAL '24 hours') as errors_24h,
        ROUND(AVG(execution_ms) FILTER (WHERE timestamp > NOW() - INTERVAL '1 hour')) as avg_ms_1h
      FROM command_usage
    `);

    // DB connection test
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;

    res.json({
      uptime,
      uptimeFormatted: formatUptime(uptime),
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss,
        external: mem.external,
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
      database: {
        latencyMs: dbLatency,
        status: dbLatency < 1000 ? 'healthy' : 'degraded',
      },
      commands: statsResult.rows[0],
    });
  } catch (err: any) {
    logger.error('Failed to get health overview', { error: err.message });
    res.status(500).json({ error: 'Failed to get health overview' });
  }
});

/* ── GET /latency — Command execution latency percentiles ── */

healthRouter.get('/latency', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const hours = Math.min(168, Math.max(1, parseInt(req.query.hours as string, 10) || 24));

    const result = await pool.query(
      `SELECT
         ROUND(AVG(execution_ms)) as avg_ms,
         ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_ms)) as p50,
         ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_ms)) as p95,
         ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_ms)) as p99,
         MIN(execution_ms) as min_ms,
         MAX(execution_ms) as max_ms,
         COUNT(*) as sample_count
       FROM command_usage
       WHERE timestamp > NOW() - make_interval(hours := $1) AND success = true`,
      [hours],
    );

    // Latency over time (hourly buckets)
    const timeline = await pool.query(
      `SELECT
         date_trunc('hour', timestamp) as period,
         ROUND(AVG(execution_ms)) as avg_ms,
         ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_ms)) as p95,
         COUNT(*) as count
       FROM command_usage
       WHERE timestamp > NOW() - make_interval(hours := $1) AND success = true
       GROUP BY period
       ORDER BY period ASC`,
      [hours],
    );

    res.json({
      summary: result.rows[0],
      timeline: timeline.rows,
    });
  } catch (err: any) {
    logger.error('Failed to get latency data', { error: err.message });
    res.status(500).json({ error: 'Failed to get latency data' });
  }
});

/* ── GET /errors — Recent error rates ── */

healthRouter.get('/errors', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const hours = Math.min(168, Math.max(1, parseInt(req.query.hours as string, 10) || 24));

    // Error rate over time
    const timeline = await pool.query(
      `SELECT
         date_trunc('hour', timestamp) as period,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE success = false) as errors,
         ROUND(100.0 * COUNT(*) FILTER (WHERE success = false) / NULLIF(COUNT(*), 0), 2) as error_rate
       FROM command_usage
       WHERE timestamp > NOW() - make_interval(hours := $1)
       GROUP BY period
       ORDER BY period ASC`,
      [hours],
    );

    // Top errors by command
    const topErrors = await pool.query(
      `SELECT
         command_name, subcommand_name, module_name,
         COUNT(*) FILTER (WHERE success = false) as error_count,
         COUNT(*) as total_count,
         ROUND(100.0 * COUNT(*) FILTER (WHERE success = false) / NULLIF(COUNT(*), 0), 2) as error_rate
       FROM command_usage
       WHERE timestamp > NOW() - make_interval(hours := $1)
       GROUP BY command_name, subcommand_name, module_name
       HAVING COUNT(*) FILTER (WHERE success = false) > 0
       ORDER BY error_count DESC
       LIMIT 20`,
      [hours],
    );

    res.json({
      timeline: timeline.rows,
      topErrors: topErrors.rows,
    });
  } catch (err: any) {
    logger.error('Failed to get error data', { error: err.message });
    res.status(500).json({ error: 'Failed to get error data' });
  }
});

/* ── GET /resources — Current memory usage ── */

healthRouter.get('/resources', async (_req: Request, res: Response) => {
  const mem = process.memoryUsage();

  res.json({
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    rss: mem.rss,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
    heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
    heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(1),
    rssMB: (mem.rss / 1024 / 1024).toFixed(1),
    uptime: Date.now() - startTime,
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid,
  });
});

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}
