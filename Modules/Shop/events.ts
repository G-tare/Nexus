import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
const logger = createModuleLogger('Shop');
import { cache } from '../../Shared/src/cache/cacheManager';
import { eventBus } from '../../Shared/src/events/eventBus';

export const shopEvents: ModuleEvent[] = [
  { event: 'giveawayEnded',
    once: false,
    handler: async (data) => {
      try {
        const prefix = `shop:gentry:${data.guildId}:${data.giveawayId}:`;
        const deleted = cache.deleteByPrefix(prefix);

        logger.info(`[Shop] Cleaned up ${deleted} giveaway entries for giveaway ${data.giveawayId}`);
      } catch (error) {
        logger.error('[Shop] Error cleaning up giveaway entries:', error);
      }
    }
  },
  { event: 'shopInit',
    once: true,
    handler: async () => {
      try {
        // XP boosts now use cache.set with TTL — they auto-expire.
        // No polling needed. The expiry callback is handled by CacheManager's setTimeout.
        // When checking if a boost is active, we just do cache.get('xp_boost:guildId:userId').
        // If it returns null, the boost has expired.
        logger.info('[Shop] Events registered (XP boosts use in-memory cache with auto-expiry)');
      } catch (error) {
        logger.error('[Shop] Error initializing shop events:', error);
      }
    }
  }
];
