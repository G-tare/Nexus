/**
 * Module Toggles API Routes — Owner dashboard endpoints for global module controls
 * and per-server module bans.
 *
 * All routes require owner authentication (authMiddleware + ownerMiddleware).
 *
 * Endpoints:
 *  GET    /api/owner/toggles                         — List all global module toggle states
 *  PATCH  /api/owner/toggles/:moduleName             — Enable/disable module globally
 *  GET    /api/owner/server-bans/:guildId            — List banned modules for a server
 *  POST   /api/owner/server-bans/:guildId/:moduleName — Ban a module for a server
 *  DELETE /api/owner/server-bans/:guildId/:moduleName — Unban a module for a server
 *  GET    /api/owner/server-bans                      — List all server bans (global view)
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { moduleConfig } from '../../middleware/moduleConfig';
import { socketManager } from '../../websocket/socketManager';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('ModuleTogglesAPI');
export const moduleTogglesRouter = Router();

const VALID_REASONS = ['update', 'glitch', 'issue', 'misuse'] as const;

/* ── GET /toggles — List all global module toggle states ── */

moduleTogglesRouter.get('/toggles', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();

    const result = await pool.query(
      `SELECT module_name, enabled, reason, reason_detail, disabled_by, updated_at
       FROM global_module_toggles
       ORDER BY module_name ASC`,
    );

    res.json({ toggles: result.rows });
  } catch (err: any) {
    logger.error('Failed to list global toggles', { error: err.message });
    res.status(500).json({ error: 'Failed to list global toggles' });
  }
});

/* ── PATCH /toggles/:moduleName — Enable/disable module globally ── */

moduleTogglesRouter.patch('/toggles/:moduleName', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const moduleName = (req.params.moduleName as string).toLowerCase();
    const { enabled, reason, reasonDetail } = req.body as {
      enabled?: boolean;
      reason?: string;
      reasonDetail?: string;
    };

    if (enabled === undefined) {
      res.status(400).json({ error: 'enabled field is required' });
      return;
    }

    // Validate reason if disabling
    if (!enabled && reason && !VALID_REASONS.includes(reason as typeof VALID_REASONS[number])) {
      res.status(400).json({ error: `Invalid reason. Must be one of: ${VALID_REASONS.join(', ')}` });
      return;
    }

    const result = await pool.query(
      `INSERT INTO global_module_toggles (module_name, enabled, reason, reason_detail, disabled_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (module_name)
       DO UPDATE SET enabled = $2, reason = $3, reason_detail = $4, disabled_by = $5, updated_at = NOW()
       RETURNING module_name, enabled, reason, reason_detail, disabled_by, updated_at`,
      [moduleName, enabled, enabled ? null : (reason || null), enabled ? null : (reasonDetail || null), enabled ? null : req.user!.id],
    );

    // Invalidate cache
    await moduleConfig.invalidateGlobalToggle(moduleName);

    // Broadcast to connected dashboards
    socketManager.broadcast('module:toggled', {
      moduleName,
      enabled,
      reason: reason || null,
      reasonDetail: reasonDetail || null,
    });

    logger.info(`Global toggle: ${moduleName} → ${enabled ? 'enabled' : 'disabled'}`, {
      by: req.user!.id,
      reason,
    });

    res.json(result.rows[0]);
  } catch (err: any) {
    logger.error('Failed to update global toggle', { error: err.message });
    res.status(500).json({ error: 'Failed to update global toggle' });
  }
});

/* ── GET /server-bans — List all server bans (global view) ── */

moduleTogglesRouter.get('/server-bans', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const result = await pool.query(
      `SELECT id, guild_id, module_name, reason, reason_detail, banned_by, created_at
       FROM server_module_bans
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );

    res.json({ bans: result.rows });
  } catch (err: any) {
    logger.error('Failed to list server bans', { error: err.message });
    res.status(500).json({ error: 'Failed to list server bans' });
  }
});

/* ── GET /server-bans/:guildId — List banned modules for a server ── */

moduleTogglesRouter.get('/server-bans/:guildId', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const guildId = req.params.guildId as string;

    const result = await pool.query(
      `SELECT id, module_name, reason, reason_detail, banned_by, created_at
       FROM server_module_bans
       WHERE guild_id = $1
       ORDER BY module_name ASC`,
      [guildId],
    );

    res.json({ bans: result.rows });
  } catch (err: any) {
    logger.error('Failed to list server bans', { error: err.message });
    res.status(500).json({ error: 'Failed to list server bans' });
  }
});

/* ── POST /server-bans/:guildId/:moduleName — Ban a module for a server ── */

moduleTogglesRouter.post('/server-bans/:guildId/:moduleName', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const guildId = req.params.guildId as string;
    const moduleName = (req.params.moduleName as string).toLowerCase();
    const { reason, reasonDetail } = req.body as {
      reason?: string;
      reasonDetail?: string;
    };

    const result = await pool.query(
      `INSERT INTO server_module_bans (guild_id, module_name, reason, reason_detail, banned_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (guild_id, module_name) DO UPDATE
         SET reason = $3, reason_detail = $4, banned_by = $5, created_at = NOW()
       RETURNING id, guild_id, module_name, reason, reason_detail, banned_by, created_at`,
      [guildId, moduleName, reason || null, reasonDetail || null, req.user!.id],
    );

    // Invalidate cache
    await moduleConfig.invalidateServerBan(guildId, moduleName);

    logger.info(`Server ban: ${moduleName} banned for ${guildId}`, { by: req.user!.id, reason });

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    logger.error('Failed to ban module for server', { error: err.message });
    res.status(500).json({ error: 'Failed to ban module for server' });
  }
});

/* ── DELETE /server-bans/:guildId/:moduleName — Unban a module for a server ── */

moduleTogglesRouter.delete('/server-bans/:guildId/:moduleName', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const guildId = req.params.guildId as string;
    const moduleName = (req.params.moduleName as string).toLowerCase();

    const result = await pool.query(
      `DELETE FROM server_module_bans
       WHERE guild_id = $1 AND module_name = $2
       RETURNING id`,
      [guildId, moduleName],
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Server ban not found' });
      return;
    }

    // Invalidate cache
    await moduleConfig.invalidateServerBan(guildId, moduleName);

    logger.info(`Server unban: ${moduleName} unbanned for ${guildId}`, { by: req.user!.id });

    res.json({ success: true });
  } catch (err: any) {
    logger.error('Failed to unban module for server', { error: err.message });
    res.status(500).json({ error: 'Failed to unban module for server' });
  }
});
