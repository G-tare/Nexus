/**
 * Infrastructure & Server Insights API Routes
 *
 * Endpoints:
 *  GET /api/owner/infrastructure/db      — Database size and connection info
 *  GET /api/owner/infrastructure/system   — System info
 *  GET /api/owner/servers/insights        — Server growth & distribution stats
 *  GET /api/owner/servers/top             — Top servers by command usage
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('InfrastructureAPI');
export const infrastructureRouter = Router();

/* ── GET /db — Database size and stats ── */

infrastructureRouter.get('/db', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();

    // Use individual try/catch for each query since some may fail on managed Postgres (e.g. Neon)
    let dbSizeBytes = 0;
    let tables: any[] = [];
    let activeConnections = 0;

    try {
      const sizeResult = await pool.query(`SELECT pg_database_size(current_database()) as db_size`);
      dbSizeBytes = parseInt(sizeResult.rows[0].db_size, 10);
    } catch (e: any) {
      logger.warn('Could not get database size', { error: e.message });
    }

    try {
      const tableResult = await pool.query(`
        SELECT
          schemaname, relname as table_name,
          pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)) as total_bytes,
          n_live_tup as row_count
        FROM pg_stat_user_tables
        WHERE EXISTS (
          SELECT 1 FROM information_schema.tables t
          WHERE t.table_schema = schemaname AND t.table_name = relname
        )
        ORDER BY pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)) DESC
        LIMIT 20
      `);
      tables = tableResult.rows;
    } catch (e: any) {
      logger.warn('Could not get table stats', { error: e.message });
    }

    try {
      const connResult = await pool.query(`SELECT count(*) as active FROM pg_stat_activity WHERE state = 'active'`);
      activeConnections = parseInt(connResult.rows[0].active, 10);
    } catch (e: any) {
      logger.warn('Could not get connection count', { error: e.message });
    }

    res.json({
      database: {
        sizeBytes: dbSizeBytes,
        sizeMB: (dbSizeBytes / 1024 / 1024).toFixed(1),
        activeConnections,
      },
      tables: tables.map((r: any) => ({
        name: r.table_name,
        sizeBytes: parseInt(r.total_bytes, 10),
        sizeMB: (parseInt(r.total_bytes, 10) / 1024 / 1024).toFixed(2),
        rowCount: parseInt(r.row_count, 10),
      })),
    });
  } catch (err: any) {
    logger.error('Failed to get DB info', { error: err.message });
    res.status(500).json({ error: 'Failed to get database info' });
  }
});

/* ── GET /system — System information ── */

infrastructureRouter.get('/system', async (_req: Request, res: Response) => {
  const mem = process.memoryUsage();

  res.json({
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    uptime: process.uptime(),
    memory: {
      heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
      heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(1),
      rssMB: (mem.rss / 1024 / 1024).toFixed(1),
    },
    env: process.env.NODE_ENV || 'development',
  });
});

/* ── GET /servers/insights — Server growth & distribution ── */

infrastructureRouter.get('/servers/insights', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();

    const [totalResult, tierResult, sizeResult] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as total_guilds,
          SUM(member_count) as total_members,
          AVG(member_count) as avg_members
        FROM guilds
      `),
      pool.query(`
        SELECT premium_tier, COUNT(*) as count
        FROM guilds
        GROUP BY premium_tier
        ORDER BY count DESC
      `),
      pool.query(`
        SELECT
          CASE
            WHEN member_count <= 50 THEN 'tiny (1-50)'
            WHEN member_count <= 250 THEN 'small (51-250)'
            WHEN member_count <= 1000 THEN 'medium (251-1K)'
            WHEN member_count <= 5000 THEN 'large (1K-5K)'
            ELSE 'massive (5K+)'
          END as size_bucket,
          COUNT(*) as count
        FROM guilds
        GROUP BY size_bucket
        ORDER BY MIN(member_count) ASC
      `),
    ]);

    res.json({
      totals: totalResult.rows[0],
      tiers: tierResult.rows,
      sizeDistribution: sizeResult.rows,
    });
  } catch (err: any) {
    logger.error('Failed to get server insights', { error: err.message });
    res.status(500).json({ error: 'Failed to get server insights' });
  }
});

/* ── GET /servers/top — Top servers by command usage ── */

infrastructureRouter.get('/servers/top', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string, 10) || 30));

    const result = await pool.query(
      `SELECT
         cu.guild_id,
         g.name as guild_name,
         g.member_count,
         g.premium_tier,
         COUNT(*) as command_count,
         COUNT(DISTINCT cu.user_id) as unique_users
       FROM command_usage cu
       LEFT JOIN guilds g ON g.id = cu.guild_id
       WHERE cu.timestamp > NOW() - make_interval(days := $1)
       GROUP BY cu.guild_id, g.name, g.member_count, g.premium_tier
       ORDER BY command_count DESC
       LIMIT $2`,
      [days, limit],
    );

    res.json({ servers: result.rows });
  } catch (err: any) {
    logger.error('Failed to get top servers', { error: err.message });
    res.status(500).json({ error: 'Failed to get top servers' });
  }
});
