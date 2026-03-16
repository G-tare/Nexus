/**
 * Staff Management API Routes — Owner-only CRUD for bot staff members.
 *
 * All routes require owner authentication (authMiddleware + ownerMiddleware).
 *
 * Endpoints:
 *  GET    /api/owner/staff          — List all staff (active and removed)
 *  POST   /api/owner/staff          — Add a new staff member
 *  PATCH  /api/owner/staff/:id      — Update role/permissions
 *  DELETE /api/owner/staff/:id      — Remove (soft-delete) a staff member
 *  GET    /api/owner/staff/activity — Recent staff activity
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { createModuleLogger } from '../../utils/logger';
import { config } from '../../config';

const logger = createModuleLogger('StaffAPI');
export const staffRouter = Router();

const VALID_ROLES = ['support', 'manager', 'owner'] as const;
type StaffRole = typeof VALID_ROLES[number];

/**
 * Resolve a Discord user by ID using the Discord REST API.
 * Returns { username, avatar } or null if not found.
 */
async function resolveDiscordUser(discordId: string): Promise<{ username: string; avatar: string | null } | null> {
  try {
    const res = await fetch(`https://discord.com/api/v10/users/${discordId}`, {
      headers: { Authorization: `Bot ${config.discord.token}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { username: string; avatar: string | null };
    return { username: data.username, avatar: data.avatar };
  } catch {
    return null;
  }
}

/* ── GET / — List all staff ── */

staffRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();

    const result = await pool.query(
      `SELECT id, discord_id, username, avatar_hash, role, permissions,
              added_by, added_at, removed_at
       FROM bot_staff
       ORDER BY
         CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
         added_at ASC`,
    );

    res.json({ staff: result.rows });
  } catch (err: any) {
    logger.error('Failed to list staff', { error: err.message });
    res.status(500).json({ error: 'Failed to list staff' });
  }
});

/* ── POST / — Add a new staff member ── */

staffRouter.post('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { discordId, role } = req.body as {
      discordId?: string;
      role?: string;
    };

    if (!discordId) {
      res.status(400).json({ error: 'discordId is required' });
      return;
    }

    if (!discordId.match(/^\d{17,20}$/)) {
      res.status(400).json({ error: 'Invalid Discord ID format' });
      return;
    }

    // Resolve the Discord user to get their username and avatar
    const discordUser = await resolveDiscordUser(discordId);
    if (!discordUser) {
      res.status(404).json({ error: 'Discord user not found. Check the ID and try again.' });
      return;
    }

    const username = discordUser.username;
    const avatarHash = discordUser.avatar;

    const staffRole: StaffRole = VALID_ROLES.includes(role as StaffRole)
      ? (role as StaffRole)
      : 'support';

    // Check if already exists
    const existing = await pool.query(
      'SELECT id, removed_at FROM bot_staff WHERE discord_id = $1',
      [discordId],
    );

    if (existing.rows[0]) {
      if (existing.rows[0].removed_at === null) {
        res.status(409).json({ error: 'Staff member already exists' });
        return;
      }

      // Re-activate previously removed staff
      const result = await pool.query(
        `UPDATE bot_staff
         SET username = $1, avatar_hash = $2, role = $3, removed_at = NULL, added_by = $4, added_at = NOW()
         WHERE discord_id = $5
         RETURNING id, discord_id, username, avatar_hash, role, added_by, added_at`,
        [username, avatarHash, staffRole, req.user!.id, discordId],
      );

      res.status(201).json(result.rows[0]);
      return;
    }

    const result = await pool.query(
      `INSERT INTO bot_staff (discord_id, username, avatar_hash, role, added_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, discord_id, username, avatar_hash, role, added_by, added_at`,
      [discordId, username, avatarHash, staffRole, req.user!.id],
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    logger.error('Failed to add staff', { error: err.message });
    res.status(500).json({ error: 'Failed to add staff member' });
  }
});

/* ── PATCH /:id — Update role/permissions ── */

staffRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const staffId = parseInt(req.params.id as string, 10);
    const { role, permissions } = req.body as {
      role?: string;
      permissions?: Record<string, boolean>;
    };

    if (isNaN(staffId)) {
      res.status(400).json({ error: 'Invalid staff ID' });
      return;
    }

    // Build dynamic update
    const updates: string[] = [];
    const params: (string | number | object)[] = [];
    let paramIdx = 1;

    if (role && VALID_ROLES.includes(role as StaffRole)) {
      updates.push(`role = $${paramIdx++}`);
      params.push(role);
    }

    if (permissions && typeof permissions === 'object') {
      updates.push(`permissions = $${paramIdx++}`);
      params.push(JSON.stringify(permissions));
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    params.push(staffId);
    const result = await pool.query(
      `UPDATE bot_staff SET ${updates.join(', ')}
       WHERE id = $${paramIdx} AND removed_at IS NULL
       RETURNING id, discord_id, username, role, permissions`,
      params,
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    logger.error('Failed to update staff', { error: err.message, staffId: req.params.id });
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

/* ── DELETE /:id — Soft-delete (set removed_at) ── */

staffRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const staffId = parseInt(req.params.id as string, 10);

    if (isNaN(staffId)) {
      res.status(400).json({ error: 'Invalid staff ID' });
      return;
    }

    // Check if this is an owner trying to remove themselves
    const staff = await pool.query(
      'SELECT discord_id, role FROM bot_staff WHERE id = $1',
      [staffId],
    );

    if (!staff.rows[0]) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    if (staff.rows[0].role === 'owner') {
      res.status(400).json({ error: 'Cannot remove owner-level staff through the API' });
      return;
    }

    const result = await pool.query(
      `UPDATE bot_staff SET removed_at = NOW()
       WHERE id = $1 AND removed_at IS NULL
       RETURNING id, discord_id, username`,
      [staffId],
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Staff member not found or already removed' });
      return;
    }

    res.json({ success: true, removed: result.rows[0] });
  } catch (err: any) {
    logger.error('Failed to remove staff', { error: err.message, staffId: req.params.id });
    res.status(500).json({ error: 'Failed to remove staff member' });
  }
});

/* ── GET /activity — Recent staff activity (ticket actions) ── */

staffRouter.get('/activity', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    // Recent ticket replies and claims by staff
    const result = await pool.query(
      `SELECT
         m.author_id as staff_id,
         m.author_name as staff_name,
         m.ticket_id,
         t.subject as ticket_subject,
         t.category as ticket_category,
         'reply' as action_type,
         m.created_at
       FROM bot_ticket_messages m
       JOIN bot_tickets t ON t.id = m.ticket_id
       WHERE m.author_type = 'staff'
       ORDER BY m.created_at DESC
       LIMIT $1`,
      [limit],
    );

    res.json({ activity: result.rows });
  } catch (err: any) {
    logger.error('Failed to get staff activity', { error: err.message });
    res.status(500).json({ error: 'Failed to get staff activity' });
  }
});
