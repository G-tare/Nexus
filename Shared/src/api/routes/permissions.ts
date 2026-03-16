import { Router, Request, Response } from 'express';
import { permissionManager } from '../../permissions/permissionManager';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('PermissionsAPI');
const router = Router();

/**
 * GET /api/permissions/:guildId
 * Get all permission rules for a guild.
 */
router.get('/:guildId', async (req: Request, res: Response) => {
  try {
    const permissions = await permissionManager.getGuildPermissions(req.params.guildId as string);
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
