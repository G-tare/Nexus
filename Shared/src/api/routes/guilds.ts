import { Router, Request, Response } from 'express';
import { getDb } from '../../database/connection';
import { guilds, guildModuleConfigs, guildMembers } from '../../database/models/schema';
import { eq } from 'drizzle-orm';
import { moduleConfig } from '../../middleware/moduleConfig';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('GuildsAPI');
const router = Router();

/**
 * GET /api/guilds/:guildId
 * Get guild info and module configuration overview.
 */
router.get('/:guildId', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const db = getDb();

    const [guild] = await db.select()
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .limit(1);

    if (!guild) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }

    // Get all module configs
    const configs = await moduleConfig.getAllConfigs(guildId);

    res.json({ guild, modules: configs });
  } catch (err: any) {
    logger.error('Get guild error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/guilds/:guildId/stats
 * Get guild statistics for dashboard overview.
 */
router.get('/:guildId/stats', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const db = getDb();

    // Get member count and other aggregate stats
    const members = await db.select()
      .from(guildMembers)
      .where(eq(guildMembers.guildId, guildId));

    const stats = {
      totalMembers: members.length,
      totalMessages: members.reduce((sum, m) => sum + Number(m.totalMessages), 0),
      totalVoiceMinutes: members.reduce((sum, m) => sum + Number(m.totalVoiceMinutes), 0),
      averageLevel: members.length > 0
        ? Math.round(members.reduce((sum, m) => sum + m.level, 0) / members.length)
        : 0,
      highestLevel: members.length > 0
        ? Math.max(...members.map(m => m.level))
        : 0,
    };

    res.json(stats);
  } catch (err: any) {
    logger.error('Get guild stats error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PATCH /api/guilds/:guildId/settings
 * Update guild settings (locale, timezone, etc.).
 */
router.patch('/:guildId/settings', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const { locale, timezone: tz } = req.body;
    const db = getDb();

    const updates: Record<string, any> = {};
    if (locale) updates.locale = locale;
    if (tz) updates.timezone = tz;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    await db.update(guilds)
      .set(updates)
      .where(eq(guilds.id, guildId));

    res.json({ success: true });
  } catch (err: any) {
    logger.error('Update guild settings error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

export { router as guildsRouter };
