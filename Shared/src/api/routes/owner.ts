import { Router, Request, Response } from 'express';
import { getDb } from '../../database/connection';
import { cache } from '../../cache/cacheManager';
import { guilds } from '../../database/models/schema';
import { eq, sql } from 'drizzle-orm';
import { createModuleLogger } from '../../utils/logger';
import type { PremiumTier } from '../../middleware/premiumCheck';

const logger = createModuleLogger('OwnerAPI');
const router = Router();

const VALID_TIERS: PremiumTier[] = ['free', 'pro', 'plus', 'premium'];

/**
 * GET /api/owner/stats
 * Global bot statistics (only accessible to bot owners).
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const db = getDb();

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
    let { tier, expiresAt } = req.body;
    const db = getDb();

    // Map legacy values to valid tiers
    if (tier === 'none') tier = 'free';
    if (tier === 'ultimate') tier = 'premium';

    // Validate tier
    if (!VALID_TIERS.includes(tier)) {
      res.status(400).json({ error: `Invalid tier: ${tier}. Must be one of: ${VALID_TIERS.join(', ')}` });
      return;
    }

    await db.update(guilds)
      .set({
        premiumTier: tier,
        premiumExpiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .where(eq(guilds.id, req.params.guildId as string));

    // Invalidate premium cache (local + pub/sub for other processes)
    const premiumGuildId = req.params.guildId as string;
    cache.del(`premium:${premiumGuildId}`);
    const { CacheInvalidator } = await import('../../cache/cacheInvalidator');
    await CacheInvalidator.publish(`premium:${premiumGuildId}`);

    res.json({ success: true, tier });
  } catch (err: any) {
    logger.error('Set premium error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PATCH /api/owner/guilds/bulk-premium
 * Bulk update premium tier for multiple guilds.
 */
router.patch('/guilds/bulk-premium', async (req: Request, res: Response) => {
  try {
    let { guildIds, tier, expiresAt } = req.body;
    const db = getDb();

    if (!Array.isArray(guildIds) || guildIds.length === 0) {
      res.status(400).json({ error: 'guildIds must be a non-empty array' });
      return;
    }

    // Map legacy values
    if (tier === 'none') tier = 'free';
    if (tier === 'ultimate') tier = 'premium';

    if (!VALID_TIERS.includes(tier)) {
      res.status(400).json({ error: `Invalid tier: ${tier}. Must be one of: ${VALID_TIERS.join(', ')}` });
      return;
    }

    // Update each guild
    let updated = 0;
    for (const guildId of guildIds) {
      await db.update(guilds)
        .set({
          premiumTier: tier,
          premiumExpiresAt: expiresAt ? new Date(expiresAt) : null,
        })
        .where(eq(guilds.id, guildId));
      cache.del(`premium:${guildId}`);
      const { CacheInvalidator } = await import('../../cache/cacheInvalidator');
      await CacheInvalidator.publish(`premium:${guildId}`);
      updated++;
    }

    res.json({ success: true, tier, updated });
  } catch (err: any) {
    logger.error('Bulk premium error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

export { router as ownerRouter };
