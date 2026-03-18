import { Router, Request, Response } from 'express';
import { permissionManager } from '../../permissions/permissionManager';
import { createModuleLogger } from '../../utils/logger';
import { getDb } from '../../database/connection';
import { users } from '../../database/models/schema';
import { inArray } from 'drizzle-orm';

const logger = createModuleLogger('PermissionsAPI');
const router = Router();

/**
 * GET /api/permissions/:guildId
 * Get all permission rules for a guild, with resolved display names for users and channels.
 */
router.get('/:guildId', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const permissions = await permissionManager.getGuildPermissions(guildId);

    // Collect user IDs that need name resolution
    const userIds = new Set<string>();
    for (const rules of Object.values(permissions)) {
      for (const rule of rules) {
        if (rule.targetType === 'user') {
          userIds.add(rule.targetId);
        }
      }
    }

    // Resolve usernames from users table
    const userLookup = new Map<string, string>();
    if (userIds.size > 0) {
      try {
        const db = getDb();
        const userRows = await db.select({ id: users.id, username: users.username, globalName: users.globalName })
          .from(users)
          .where(inArray(users.id, [...userIds]));
        for (const u of userRows) {
          if (u.globalName || u.username) {
            userLookup.set(u.id, u.globalName || u.username || u.id);
          }
        }
      } catch {
        // Non-fatal — IDs will still be shown as fallback
      }
    }

    // Attach resolvedName to user rules
    for (const rules of Object.values(permissions)) {
      for (const rule of rules) {
        if (rule.targetType === 'user') {
          (rule as any).resolvedName = userLookup.get(rule.targetId) || null;
        }
      }
    }

    res.json(permissions);
  } catch (err: any) {
    logger.error('Get permissions error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/permissions/:guildId
 * Set a permission rule.
 */
router.post('/:guildId', async (req: Request, res: Response) => {
  try {
    // Accept both camelCase and snake_case — iOS encoder sends snake_case
    const command = req.body.command;
    const targetType = req.body.targetType ?? req.body.target_type;
    const targetId = req.body.targetId ?? req.body.target_id;
    const allowed = req.body.allowed;

    if (!command || !targetType || !targetId || typeof allowed !== 'boolean') {
      logger.warn('Set permission missing fields', { body: req.body });
      res.status(400).json({ error: 'Missing required fields: command, targetType, targetId, allowed' });
      return;
    }

    if (!['role', 'user', 'channel'].includes(targetType)) {
      res.status(400).json({ error: 'targetType must be: role, user, or channel' });
      return;
    }

    const guildId = req.params.guildId as string;
    await permissionManager.setPermission(
      guildId,
      command,
      targetType,
      targetId,
      allowed
    );
    const { CacheInvalidator } = await import('../../cache/cacheInvalidator');
    await CacheInvalidator.publish(`perms:${guildId}:*`);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Set permission error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * DELETE /api/permissions/:guildId
 * Remove a permission rule.
 */
router.delete('/:guildId', async (req: Request, res: Response) => {
  try {
    // Accept both camelCase and snake_case
    const command = req.body.command;
    const targetId = req.body.targetId ?? req.body.target_id;

    if (!command || !targetId) {
      res.status(400).json({ error: 'Missing required fields: command, targetId' });
      return;
    }

    const gid = req.params.guildId as string;
    await permissionManager.removePermission(gid, command, targetId);
    const { CacheInvalidator } = await import('../../cache/cacheInvalidator');
    await CacheInvalidator.publish(`perms:${gid}:*`);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Remove permission error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

export { router as permissionsRouter };
