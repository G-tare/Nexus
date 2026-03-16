/**
 * Server Management API Routes — Owner dashboard endpoints for managing bot servers/guilds.
 *
 * All routes require owner authentication (authMiddleware + ownerMiddleware).
 * This router is mounted at /api/owner/servers.
 *
 * Endpoints:
 *  GET    /search                       — Search and filter servers with pagination
 *  GET    /:guildId/detail              — Get detailed info for a single server
 *  PATCH  /:guildId/config              — Update guild settings (locale, timezone, premium)
 *  POST   /:guildId/leave               — Soft-leave a guild (mark inactive)
 *  POST   /:guildId/reset-config        — Reset all module configs to defaults
 *  GET    /announcements                — List bot announcements
 *  POST   /announcements                — Create a new announcement
 *  DELETE /announcements/:id             — Delete an announcement
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { cache } from '../../cache/cacheManager';
import { socketManager } from '../../websocket/socketManager';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('ServerManagementAPI');
export const serverManagementRouter = Router();

const VALID_PREMIUM_TIERS = ['free', 'pro', 'plus', 'premium'];

/* ── GET /search — Search servers with filters, sorting, and pagination ── */

serverManagementRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    // Parse query parameters
    const q = (req.query.q as string) || '';
    const tier = (req.query.tier as string) || '';
    const status = (req.query.status as string) || '';
    const sort = (req.query.sort as string) || 'name';
    const order = ((req.query.order as string) || 'asc').toLowerCase();
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 25));
    const offset = (page - 1) * limit;

    // Validate order
    if (!['asc', 'desc'].includes(order)) {
      res.status(400).json({ error: 'order must be asc or desc' });
      return;
    }

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (q) {
      conditions.push(`(name ILIKE $${paramIdx} OR id = $${paramIdx + 1})`);
      params.push(`%${q}%`, q);
      paramIdx += 2;
    }

    if (tier && VALID_PREMIUM_TIERS.includes(tier)) {
      conditions.push(`premium_tier = $${paramIdx++}`);
      params.push(tier);
    }

    if (status === 'active') {
      conditions.push(`is_active = true`);
    } else if (status === 'inactive') {
      conditions.push(`is_active = false`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build ORDER BY clause
    let orderBy = 'name';
    switch (sort) {
      case 'members':
        orderBy = 'member_count';
        break;
      case 'joined':
        orderBy = 'joined_at';
        break;
      case 'usage':
        orderBy = 'usage_count';
        break;
      case 'name':
      default:
        orderBy = 'name';
    }

    // For usage sort, we need a LEFT JOIN with a subquery
    let query: string;
    let countQuery: string;

    if (sort === 'usage') {
      query = `
        SELECT
          g.id, g.name, g.icon, g.owner_id, g.member_count,
          g.premium_tier, g.premium_expires_at, g.locale, g.timezone,
          g.joined_at, g.left_at, g.is_active,
          COALESCE(cu.command_count, 0) as usage_count
        FROM guilds g
        LEFT JOIN (
          SELECT guild_id, COUNT(*) as command_count
          FROM command_usage
          WHERE timestamp > NOW() - INTERVAL '30 days'
          GROUP BY guild_id
        ) cu ON g.id = cu.guild_id
        ${where}
        ORDER BY ${orderBy} ${order}
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `;
      countQuery = `
        SELECT COUNT(*) as total
        FROM guilds g
        ${where}
      `;
    } else {
      query = `
        SELECT
          id, name, icon, owner_id, member_count,
          premium_tier, premium_expires_at, locale, timezone,
          joined_at, left_at, is_active
        FROM guilds
        ${where}
        ORDER BY ${orderBy} ${order}
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `;
      countQuery = `
        SELECT COUNT(*) as total
        FROM guilds
        ${where}
      `;
    }

    // Execute count query
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || 0, 10);
    const totalPages = Math.ceil(total / limit);

    // Execute main query
    params.push(limit, offset);
    const result = await pool.query(query, params);

    res.json({
      servers: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    logger.error('Failed to search servers', { error: err.message });
    res.status(500).json({ error: 'Failed to search servers' });
  }
});

/* ── GET /:guildId/detail — Get detailed server information ── */

serverManagementRouter.get('/:guildId/detail', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { guildId } = req.params;

    // Get guild details
    const guildResult = await pool.query(
      `SELECT id, name, icon, owner_id, member_count, premium_tier, premium_expires_at,
              locale, timezone, joined_at, left_at, is_active
       FROM guilds
       WHERE id = $1`,
      [guildId],
    );

    if (!guildResult.rows[0]) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }

    const server = guildResult.rows[0];

    // Get module stats (count of enabled modules)
    const moduleStatsResult = await pool.query(
      `SELECT COUNT(*) as enabled_count
       FROM guild_module_configs
       WHERE guild_id = $1 AND enabled = true`,
      [guildId],
    );

    const enabledCount = parseInt(moduleStatsResult.rows[0]?.enabled_count || 0, 10);

    // Get usage stats (commands in last 30 days)
    const usageStatsResult = await pool.query(
      `SELECT
         COUNT(*) as commands_30d,
         COUNT(DISTINCT user_id) as unique_users_30d
       FROM command_usage
       WHERE guild_id = $1 AND timestamp > NOW() - INTERVAL '30 days'`,
      [guildId],
    );

    const usageStats = {
      commands30d: parseInt(usageStatsResult.rows[0]?.commands_30d || 0, 10),
      uniqueUsers30d: parseInt(usageStatsResult.rows[0]?.unique_users_30d || 0, 10),
    };

    // Get premium subscription info if exists
    const subscriptionResult = await pool.query(
      `SELECT id, guild_id, tier, purchase_date, expiry_date, auto_renew, status
       FROM premium_subscriptions
       WHERE guild_id = $1
       ORDER BY purchase_date DESC
       LIMIT 1`,
      [guildId],
    );

    const subscription = subscriptionResult.rows[0] || null;

    res.json({
      server,
      moduleStats: {
        enabledCount,
      },
      usageStats,
      subscription,
    });
  } catch (err: any) {
    logger.error('Failed to get server detail', { error: err.message });
    res.status(500).json({ error: 'Failed to get server detail' });
  }
});

/* ── PATCH /:guildId/config — Update guild configuration ── */

serverManagementRouter.patch('/:guildId/config', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { guildId } = req.params;
    const { locale, timezone, premium_tier, premium_expires_at } = req.body;

    // Validate premium_tier if provided
    if (premium_tier !== undefined && !VALID_PREMIUM_TIERS.includes(premium_tier)) {
      res.status(400).json({
        error: `Invalid premium_tier. Must be one of: ${VALID_PREMIUM_TIERS.join(', ')}`,
      });
      return;
    }

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (locale !== undefined) {
      updates.push(`locale = $${paramIdx++}`);
      params.push(locale);
    }

    if (timezone !== undefined) {
      updates.push(`timezone = $${paramIdx++}`);
      params.push(timezone);
    }

    if (premium_tier !== undefined) {
      updates.push(`premium_tier = $${paramIdx++}`);
      params.push(premium_tier);
    }

    if (premium_expires_at !== undefined) {
      updates.push(`premium_expires_at = $${paramIdx++}`);
      params.push(premium_expires_at ? new Date(premium_expires_at) : null);
    }

    // If no fields to update, return error
    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(guildId);
    const updateResult = await pool.query(
      `UPDATE guilds
       SET ${updates.join(', ')}
       WHERE id = $${paramIdx}
       RETURNING id`,
      params,
    );

    if (!updateResult.rows[0]) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }

    // Invalidate premium cache if tier changed
    if (premium_tier !== undefined) {
      cache.del(`premium:${guildId}`);
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error('Failed to update guild config', { error: err.message });
    res.status(500).json({ error: 'Failed to update guild config' });
  }
});

/* ── POST /:guildId/leave — Soft-leave a guild (mark inactive) ── */

serverManagementRouter.post('/:guildId/leave', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { guildId } = req.params;

    const result = await pool.query(
      `UPDATE guilds
       SET is_active = false, left_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [guildId],
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error('Failed to leave guild', { error: err.message });
    res.status(500).json({ error: 'Failed to leave guild' });
  }
});

/* ── POST /:guildId/reset-config — Delete all module configs (hard reset) ── */

serverManagementRouter.post('/:guildId/reset-config', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { guildId } = req.params;

    const result = await pool.query(
      `DELETE FROM guild_module_configs
       WHERE guild_id = $1`,
      [guildId],
    );

    res.json({
      success: true,
      deletedCount: result.rowCount || 0,
    });
  } catch (err: any) {
    logger.error('Failed to reset guild config', { error: err.message });
    res.status(500).json({ error: 'Failed to reset guild config' });
  }
});

/* ── GET /announcements — List all announcements with pagination ── */

serverManagementRouter.get('/announcements', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 25));
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM bot_announcements`,
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);
    const totalPages = Math.ceil(total / limit);

    // Get announcements
    const result = await pool.query(
      `SELECT id, title, message, type, author_id, created_at
       FROM bot_announcements
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    res.json({
      announcements: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    logger.error('Failed to list announcements', { error: err.message });
    res.status(500).json({ error: 'Failed to list announcements' });
  }
});

/* ── POST /announcements — Create a new announcement ── */

serverManagementRouter.post('/announcements', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { title, message, type } = req.body;
    const authorId = (req as any).user?.id;

    // Validate required fields
    if (!title || !message || !type) {
      res.status(400).json({ error: 'title, message, and type are required' });
      return;
    }

    // Validate type
    const validTypes = ['info', 'warning', 'update', 'maintenance'];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
      return;
    }

    if (!authorId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Insert announcement
    const result = await pool.query(
      `INSERT INTO bot_announcements (title, message, type, author_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, title, message, type, author_id, created_at`,
      [title, message, type, authorId],
    );

    const announcement = result.rows[0];

    // Broadcast via WebSocket
    socketManager.broadcast('stats:update', {
      type: 'announcement',
      announcement,
    });

    res.status(201).json({ announcement });
  } catch (err: any) {
    logger.error('Failed to create announcement', { error: err.message });
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

/* ── DELETE /announcements/:id — Delete an announcement ── */

serverManagementRouter.delete('/announcements/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM bot_announcements
       WHERE id = $1
       RETURNING id`,
      [id],
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error('Failed to delete announcement', { error: err.message });
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});
