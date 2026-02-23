import { getDb } from '../database/connection';
import { getRedis } from '../database/connection';
import { guilds } from '../database/models/schema';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('Premium');

export type PremiumTier = 'free' | 'premium' | 'ultimate';

// Feature → minimum tier required
// When PREMIUM_ENABLED=false, ALL features are accessible (for testing)
const featureTiers: Record<string, PremiumTier> = {
  // Free features
  'moderation.basic': 'free',
  'welcome.text': 'free',
  'leveling.basic': 'free',
  'currency.single': 'free',
  'automod.basic': 'free',
  'counting': 'free',
  'reaction_roles': 'free',
  'reminders': 'free',
  'fun': 'free',
  'afk': 'free',
  'reputation': 'free',
  'polls.basic': 'free',

  // Premium features
  'welcome.images': 'premium',
  'welcome.dm': 'premium',
  'logging.full': 'premium',
  'confessions': 'premium',
  'tickets': 'premium',
  'giveaways': 'premium',
  'boards': 'premium',
  'invite_tracker': 'premium',
  'music': 'premium',
  'currency.multi': 'premium',
  'shop': 'premium',
  'color_roles': 'premium',
  'ai_chatbot': 'premium',
  'forms': 'premium',
  'suggestions': 'premium',
  'scheduled_messages': 'premium',
  'translation': 'premium',
  'custom_commands': 'premium',
  'leaderboards.auto': 'premium',
  'temp_voice': 'premium',
  'sticky_messages': 'premium',
  'userphone': 'premium',
  'message_tracking': 'premium',

  // Ultimate features
  'backup': 'ultimate',
  'anti_raid': 'ultimate',
  'anti_nuke': 'ultimate',
  'stats_channels': 'ultimate',
  'music.247': 'ultimate',
  'custom_branding': 'ultimate',
  'advanced_analytics': 'ultimate',
  'priority_support': 'ultimate',
};

const tierPriority: Record<PremiumTier, number> = {
  free: 0,
  premium: 1,
  ultimate: 2,
};

export class PremiumManager {
  /**
   * Check if a guild has access to a feature.
   * When PREMIUM_ENABLED=false (testing mode), always returns true.
   */
  async hasFeature(guildId: string, featureKey: string): Promise<boolean> {
    // Testing mode: everything unlocked
    if (!config.premium.enabled) {
      return true;
    }

    const requiredTier = featureTiers[featureKey];
    if (!requiredTier || requiredTier === 'free') {
      return true; // Unknown features or free features always allowed
    }

    const guildTier = await this.getGuildTier(guildId);
    return tierPriority[guildTier] >= tierPriority[requiredTier];
  }

  /**
   * Get a guild's premium tier.
   */
  async getGuildTier(guildId: string): Promise<PremiumTier> {
    const redis = getRedis();
    const cacheKey = `premium:${guildId}`;

    // Try cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return cached as PremiumTier;
    } catch { /* fall through */ }

    // Query DB
    const db = getDb();
    const [guild] = await db.select({
      tier: guilds.premiumTier,
      expiresAt: guilds.premiumExpiresAt,
    })
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .limit(1);

    if (!guild) return 'free';

    // Check expiry
    let tier = guild.tier as PremiumTier;
    if (guild.expiresAt && new Date(guild.expiresAt) < new Date()) {
      tier = 'free';
      // Update DB to reflect expired premium
      await db.update(guilds)
        .set({ premiumTier: 'free', premiumExpiresAt: null })
        .where(eq(guilds.id, guildId));
    }

    // Cache for 5 minutes
    try {
      await redis.setex(cacheKey, 300, tier);
    } catch { /* ignore */ }

    return tier;
  }

  /**
   * Get the required tier for a feature.
   */
  getRequiredTier(featureKey: string): PremiumTier {
    return featureTiers[featureKey] || 'free';
  }

  /**
   * Register a new feature tier requirement (for dynamic module registration).
   */
  registerFeature(featureKey: string, tier: PremiumTier): void {
    featureTiers[featureKey] = tier;
  }

  /**
   * Get all feature tier mappings (for dashboard display).
   */
  getAllFeatureTiers(): Record<string, PremiumTier> {
    return { ...featureTiers };
  }
}

export const premiumManager = new PremiumManager();
export default premiumManager;
