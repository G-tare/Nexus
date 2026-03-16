/**
 * CacheInvalidator — Redis pub/sub for dashboard → bot cache invalidation.
 *
 * Uses a single Redis SUBSCRIBE (near-zero command cost — subscriptions are
 * persistent connections, not polled). When the API/dashboard changes a config,
 * it publishes a message to the 'cache:invalidate' channel. The bot's subscriber
 * receives it and clears the matching in-memory cache entry.
 *
 * Cost: ~0 commands/month for idle state. 1 PUBLISH per config change.
 */

import Redis from 'ioredis';
import { config } from '../config';
import { cache } from './cacheManager';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('CacheInvalidator');

const CHANNEL = 'cache:invalidate';

export class CacheInvalidator {
  private subClient: Redis | null = null;
  private initialized = false;

  /**
   * Initialize the subscriber. Call once during bot startup.
   * Creates a dedicated Redis connection for SUBSCRIBE mode
   * (ioredis requires a separate connection for subscriptions).
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      this.subClient = new Redis(config.database.redis, {
        maxRetriesPerRequest: null, // Subscriber should retry indefinitely
        retryStrategy(times) {
          const delay = Math.min(times * 200, 5000);
          return delay;
        },
        lazyConnect: true,
      });

      await this.subClient.connect();

      this.subClient.on('message', (channel: string, message: string) => {
        if (channel !== CHANNEL) return;
        this.onMessage(message);
      });

      this.subClient.on('error', (err) => {
        logger.error('Subscriber error', { error: err.message });
      });

      await this.subClient.subscribe(CHANNEL);
      this.initialized = true;
      logger.info('Cache invalidation subscriber connected');
    } catch (err: any) {
      logger.error('Failed to initialize cache invalidator', { error: err.message });
      // Non-fatal: cache will still work with TTL-based expiry
    }
  }

  /**
   * Handle incoming invalidation message.
   * Message format: "key" or "prefix:*" for bulk invalidation.
   */
  private onMessage(message: string): void {
    try {
      if (message.endsWith(':*')) {
        // Prefix-based invalidation (e.g., "perms:123456:*")
        const prefix = message.slice(0, -1); // Remove trailing *
        const count = cache.deleteByPrefix(prefix);
        logger.debug('Cache prefix invalidated', { prefix, count });
      } else {
        // Exact key invalidation (e.g., "modcfg:123456:moderation")
        cache.del(message);
        logger.debug('Cache key invalidated', { key: message });
      }
    } catch (err: any) {
      logger.error('Error processing invalidation message', { message, error: err.message });
    }
  }

  /**
   * Publish an invalidation message. Called from API routes after config changes.
   * Uses the main Redis client (not the subscriber).
   *
   * @param keyOrPattern Exact key or "prefix:*" pattern
   */
  static async publish(keyOrPattern: string): Promise<void> {
    try {
      // Lazy import to avoid circular dependency
      const { getRedis } = await import('../database/connection');
      const redis = getRedis();
      await redis.publish(CHANNEL, keyOrPattern);
      logger.debug('Published cache invalidation', { key: keyOrPattern });
    } catch (err: any) {
      logger.error('Failed to publish cache invalidation', { error: err.message });
      // Non-fatal: cache entry will expire via TTL
    }
  }

  /**
   * Clean up subscriber connection.
   */
  async disconnect(): Promise<void> {
    if (this.subClient) {
      await this.subClient.unsubscribe(CHANNEL);
      await this.subClient.disconnect();
      this.subClient = null;
      this.initialized = false;
    }
  }
}

/** Singleton invalidator — initialized once on bot startup. */
export const invalidator = new CacheInvalidator();
