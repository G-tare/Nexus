import { Router, Request, Response } from 'express';
import { getDb } from '../../database/connection';
import { botManagers } from '../../database/models/schema';
import { eq, and } from 'drizzle-orm';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('ManagersAPI');
const router = Router();

/**
 * GET /api/managers/:guildId
 * Get all bot managers (roles & users) for a guild.
 */
router.get('/:guildId', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(botManagers)
      .where(eq(botManagers.guildId, req.params.guildId as string));

    res.json({ managers: rows });
  } catch (err: any) {
    logger.error('Get managers error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/managers/:guildId
 * Add a bot manager (role or user).
 */
router.post('/:guildId', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const targetType = req.body.targetType ?? req.body.target_type;
    const targetId = req.body.targetId ?? req.body.target_id;

    if (!targetType || !targetId) {
      res.status(400).json({ error: 'Missing required fields: targetType, targetId' });
      return;
    }

    if (!['role', 'user'].includes(targetType)) {
      res.status(400).json({ error: 'targetType must be: role or user' });
      return;
    }

    // Get the authenticated user from JWT (set by authMiddleware)
    const userId = (req as any).user?.id || 'unknown';

    await db
      .insert(botManagers)
      .values({
        guildId: req.params.guildId as string,
        targetType,
        targetId,
        addedBy: userId,
      })
      .onConflictDoNothing();

    res.json({ success: true });
  } catch (err: any) {
    logger.error('Add manager error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * DELETE /api/managers/:guildId
 * Remove a bot manager.
 */
router.delete('/:guildId', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const targetType = req.body.targetType ?? req.body.target_type;
    const targetId = req.body.targetId ?? req.body.target_id;

    if (!targetType || !targetId) {
      res.status(400).json({ error: 'Missing required fields: targetType, targetId' });
      return;
    }

    await db
      .delete(botManagers)
      .where(
        and(
          eq(botManagers.guildId, req.params.guildId as string),
          eq(botManagers.targetType, targetType),
          eq(botManagers.targetId, targetId),
        )
      );

    res.json({ success: true });
  } catch (err: any) {
    logger.error('Remove manager error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

export { router as managersRouter };
