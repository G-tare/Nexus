/**
 * Staff Authentication Middleware
 *
 * Checks if the authenticated user is a bot staff member (or owner).
 * Owners always pass. Staff must exist in the bot_staff table with an active record
 * (removedAt IS NULL). The middleware attaches the staff role to the request for
 * downstream use.
 *
 * Roles:
 *  - owner   — full access (OWNER_IDS env var, auto-seeded)
 *  - manager — analytics, server management, module toggles, tickets
 *  - support — view/respond to tickets only
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../../config';
import { getPool } from '../../database/connection';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('StaffAuth');

export type StaffRole = 'owner' | 'manager' | 'support';

declare global {
  namespace Express {
    interface Request {
      staffRole?: StaffRole;
      isStaff?: boolean;
    }
  }
}

/**
 * Middleware that checks if the user is a staff member or owner.
 * Attaches `req.staffRole` and `req.isStaff` to the request.
 */
export function staffMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Owners always have full access
  if (config.discord.ownerIds.includes(req.user.id)) {
    req.staffRole = 'owner';
    req.isStaff = true;
    next();
    return;
  }

  // Check bot_staff table
  const pool = getPool();
  pool.query(
    'SELECT role FROM bot_staff WHERE discord_id = $1 AND removed_at IS NULL',
    [req.user.id],
  )
    .then((result) => {
      if (!result.rows[0]) {
        res.status(403).json({ error: 'Staff access required' });
        return;
      }

      req.staffRole = result.rows[0].role as StaffRole;
      req.isStaff = true;
      next();
    })
    .catch((err) => {
      logger.error('Failed to check staff status', { error: err.message });
      res.status(500).json({ error: 'Internal error checking staff status' });
    });
}

/**
 * Creates a middleware that requires a minimum staff role.
 * Role hierarchy: support < manager < owner
 */
export function requireRole(minRole: StaffRole) {
  const roleLevel: Record<StaffRole, number> = {
    support: 0,
    manager: 1,
    owner: 2,
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.isStaff || !req.staffRole) {
      res.status(403).json({ error: 'Staff access required' });
      return;
    }

    if (roleLevel[req.staffRole] < roleLevel[minRole]) {
      res.status(403).json({ error: `Requires ${minRole} role or higher` });
      return;
    }

    next();
  };
}

/**
 * Seed OWNER_IDS into the bot_staff table with role='owner'.
 * Called on API server startup for backward compatibility.
 * Fetches actual Discord usernames via the Discord API when BOT_TOKEN is available.
 */
export async function seedOwnerStaff(): Promise<void> {
  try {
    const pool = getPool();
    const botToken = config.discord.token;

    for (const ownerId of config.discord.ownerIds) {
      let username = 'Owner';
      let avatarHash: string | null = null;

      // Try to fetch the actual Discord user info via bot token
      if (botToken) {
        try {
          const resp = await fetch(`https://discord.com/api/v10/users/${ownerId}`, {
            headers: { Authorization: `Bot ${botToken}` },
          });
          if (resp.ok) {
            const userData = await resp.json() as { global_name?: string; username?: string; avatar?: string };
            username = userData.global_name || userData.username || 'Owner';
            avatarHash = userData.avatar || null;
          }
        } catch {
          // Non-critical — fall back to 'Owner'
        }
      }

      await pool.query(
        `INSERT INTO bot_staff (discord_id, username, avatar_hash, role, added_by)
         VALUES ($1, $2, $3, 'owner', 'system')
         ON CONFLICT (discord_id)
         DO UPDATE SET role = 'owner', removed_at = NULL, username = $2, avatar_hash = $3`,
        [ownerId, username, avatarHash],
      );
    }

    logger.info(`Seeded ${config.discord.ownerIds.length} owner(s) into bot_staff`);
  } catch (err: any) {
    logger.error('Failed to seed owner staff', { error: err.message });
  }
}

/**
 * Sync the current user's info (username, avatar) to the bot_staff table.
 * Called when an owner or staff member accesses the dashboard to keep data fresh.
 */
export async function syncStaffUserInfo(discordId: string, username: string, avatar: string | null): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `UPDATE bot_staff SET username = $1, avatar_hash = $2
       WHERE discord_id = $3 AND removed_at IS NULL`,
      [username, avatar, discordId],
    );
  } catch {
    // Non-critical
  }
}
