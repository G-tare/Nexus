import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
const logger = createModuleLogger('Shop');
import { getDb } from '../../Shared/src/database/connection';
import { getRedis } from '../../Shared/src/database/connection';
import { eventBus } from '../../Shared/src/events/eventBus';

export const shopEvents: ModuleEvent[] = [
  { event: 'giveawayEnded',
    once: false,
    handler: async (data) => {
      try {
        const redis = getRedis();
        const pattern = `shop:gentry:${data.guildId}:${data.giveawayId}:*`;
        const keys = await redis.keys(pattern);

        if (keys.length > 0) {
          await redis.del(...keys);
        }

        logger.info(`[Shop] Cleaned up ${keys.length} giveaway entries for giveaway ${data.giveawayId}`);
      } catch (error) {
        logger.error('[Shop] Error cleaning up giveaway entries:', error);
      }
    }
  },
  { event: 'shopInit',
    once: true,
    handler: async () => {
      try {
        // Check for expired XP boosts periodically
        setInterval(async () => {
          try {
            const redis = getRedis();
            const pattern = 'xp_boost:*';
            const keys = await redis.keys(pattern);

            for (const key of keys) {
              const data = await redis.get(key);
              if (!data) continue;

              const boostData = JSON.parse(data);
              if (new Date(boostData.expiresAt) < new Date()) {
                await redis.del(key);

                const parts = key.split(':');
                const guildId = parts[1];
                const userId = parts[2];

                eventBus.emit('xpBoostExpired', {
                  guildId,
                  userId,
                  boostType: 'xp',
                });

                logger.debug(`[Shop] XP boost expired for user ${userId}`);
              }
            }
          } catch (error) {
            logger.error('[Shop] Error checking XP boosts:', error);
          }
        }, 60000); // Check every minute

        logger.info('[Shop] Events registered');
      } catch (error) {
        logger.error('[Shop] Error initializing shop events:', error);
      }
    }
  }
];
