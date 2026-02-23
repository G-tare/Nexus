import { Router, Request, Response } from 'express';
import { getDb } from '../../database/connection';
import { guilds } from '../../database/models/schema';
import { eq, sql } from 'drizzle-orm';
import { getRedis } from '../../database/connection';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('OwnerAPI');
const router = Router();

/**
 * GET /api/owner/stats
 * Global bot statistics (only accessible to bot owners).
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const redis = getRedis();

    // Total guilds
    const [guildCount] = await db.select({
      count: sql<number>`count(*)`,
    }).from(guilds).where(eq(guilds.isActive, true));

    // Premium stats
    const premiumStats = await db.select({
      tier: guilds.premiumTier,
      count: sql<number>`count(*)`,
    })
      .from(guilds)
      .where(eq(guilds.isActive, true))
      .groupBy(guilds.premiumTier);

    res.json({
      totalGuilds: guildCount?.count || 0,
      premiumBreakdown: premiumStats,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Owner stats error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/owner/guilds
 * List all guilds the bot is in (paginated).
 */
router.get('/guilds', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = (page - 1) * limit;

    const allGuilds = await db.select()
      .from(guilds)
      .where(eq(guilds.isActive, true))
      .limit(limit)
      .offset(offset);

    res.json({ guilds: allGuilds, page, limit });
  } catch (err: any) {
    logger.error('Owner guilds error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PATCH /api/owner/guilds/:guildId/premium
 * Set premium tier for a guild (owner override).
 */
router.patch('/guilds/:guildId/premium', async (req: Request, res: Response) => {
  try {
    const { tier, expiresAt } = req.body;
    const db = getDb();

    await db.update(guilds)
      .set({
        premiumTier: tier,
        premiumExpiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .where(eq(guilds.id, req.params.guildId as string));

    // Invalidate premium cache
    const redis = getRedis();
    await redis.del(`premium:${req.params.guildId as string}`);

    res.json({ success: true });
  } catch (err: any) {
    logger.error('Set premium error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

export { router as ownerRouter };
