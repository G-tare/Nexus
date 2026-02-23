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
    const { command, targetType, targetId, allowed } = req.body;

    if (!command || !targetType || !targetId || typeof allowed !== 'boolean') {
      res.status(400).json({ error: 'Missing required fields: command, targetType, targetId, allowed' });
      return;
    }

    if (!['role', 'user', 'channel'].includes(targetType)) {
      res.status(400).json({ error: 'targetType must be: role, user, or channel' });
      return;
    }

    await permissionManager.setPermission(
      req.params.guildId as string,
      command,
      targetType,
      targetId,
      allowed
    );

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
    const { command, targetId } = req.body;

    if (!command || !targetId) {
      res.status(400).json({ error: 'Missing required fields: command, targetId' });
      return;
    }

    await permissionManager.removePermission(req.params.guildId as string, command, targetId);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Remove permission error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

export { router as permissionsRouter };
