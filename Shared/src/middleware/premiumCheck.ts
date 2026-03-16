import { getDb } from '../database/connection';
import { cache } from '../cache/cacheManager';
import { guilds } from '../database/models/schema';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('Premium');

export type PremiumTier = 'free' | 'pro' | 'plus' | 'premium';

// Feature → minimum tier required
// When PREMIUM_ENABLED=false, ALL features are accessible (for testing)
const featureTiers: Record<string, PremiumTier> = {
  // ── Free features ──
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

  // ── Pro features ──
  'welcome.images': 'pro',
  'welcome.dm': 'pro',
  'logging.full': 'pro',
  'confessions': 'pro',
  'tickets': 'pro',
  'giveaways': 'pro',
  'boards': 'pro',
  'invite_tracker': 'pro',
  'music': 'pro',
  'currency.multi': 'pro',
  'shop': 'pro',
  'color_roles': 'pro',
  'forms': 'pro',
  'suggestions': 'pro',
  'scheduled_messages': 'pro',
  'translation': 'pro',
  'custom_commands': 'pro',
  'leaderboards.auto': 'pro',
  'temp_voice': 'pro',
  'sticky_messages': 'pro',
  'userphone': 'pro',
  'message_tracking': 'pro',

  // ── Plus features ──
  'ai_chatbot': 'plus',
  'voicephone': 'plus',
  'advanced_analytics': 'plus',
  'soundboard': 'plus',
  'backup': 'plus',
  'anti_raid': 'plus',
  'stats_channels': 'plus',
  'profile': 'plus',
  'family': 'plus',
  'birthdays': 'plus',
  'donation_tracking': 'plus',
  'casino': 'plus',
  'music.247': 'plus',

  // ── Premium features ──
  'anti_nuke': 'premium',
  'custom_branding': 'premium',
  'priority_support': 'premium',
  'higher_rate_limits': 'premium',
  'early_access': 'premium',
};

const tierPriority: Record<PremiumTier, number> = {
  free: 0,
  pro: 1,
  plus: 2,
  premium: 3,
};

/** Get the display name for a tier. */
export function getTierDisplayName(tier: PremiumTier): string {
  const names: Record<PremiumTier, string> = {
    free: 'Free',
    pro: 'Pro',
    plus: 'Plus',
    premium: 'Premium',
  };
  return names[tier] ?? 'Free';
}

/** Get the numeric priority for a tier. Higher = more features. */
export function getTierPriority(tier: PremiumTier): number {
  return tierPriority[tier] ?? 0;
}

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
    const cacheKey = `premium:${guildId}`;

    // Try in-memory cache
    const cached = cache.get<PremiumTier>(cacheKey);
    if (cached !== null) return cached;

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

    // Cache for 5 minutes in memory
    cache.set(cacheKey, tier, 300);

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
