import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { config } from '../config';
import { createModuleLogger } from '../utils/logger';
import * as schema from './models/schema';

// Re-export cache infrastructure singletons for convenient access
export { cache } from '../cache/cacheManager';
export { timers } from '../cache/timerManager';
import { invalidator } from '../cache/cacheInvalidator';

const logger = createModuleLogger('Database');

// ============================================
// PostgreSQL Connection
// ============================================

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      max: 10,
      // Neon suspends after ~5min idle — drop stale connections before they rot
      idleTimeoutMillis: 20_000, // 20s idle → close connection (Neon drops after ~5min anyway)
      connectionTimeoutMillis: 10_000, // 10s to establish (Neon cold starts can be slow)
      // statement_timeout kills queries stuck on dead connections instead of waiting for TCP timeout
      statement_timeout: 15_000, // 15s max per query
    });

    pool.on('error', (err) => {
      // Stale connection errors after sleep — pool will create fresh ones automatically
      if (err.message.includes('ETIMEDOUT') || err.message.includes('ECONNRESET')) {
        logger.warn('PostgreSQL connection dropped (likely sleep/network change), pool will reconnect');
      } else {
        logger.error('Unexpected PostgreSQL pool error', { error: err.message });
      }
    });

    pool.on('connect', () => {
      logger.debug('New PostgreSQL connection established');
    });
  }
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

// ============================================
// Redis Connection
// ============================================

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.database.redis, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        logger.warn(`Redis reconnecting... attempt ${times}`);
        return delay;
      },
      lazyConnect: true,
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
    });

    redis.on('error', (err) => {
      logger.error('Redis error', { error: err.message });
    });
  }
  return redis;
}

// ============================================
// Connection Management
// ============================================

export async function connectAll(): Promise<void> {
  logger.info('Connecting to databases...');

  // Test PostgreSQL
  const pgPool = getPool();
  try {
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('PostgreSQL connected');
  } catch (err: any) {
    logger.error('Failed to connect to PostgreSQL', { error: err.message });
    throw err;
  }

  // Connect Redis
  const redisClient = getRedis();
  try {
    await redisClient.connect();
    logger.info('Redis connected');
  } catch (err: any) {
    // Redis may already be connected via lazy connect
    if (err.message !== 'Redis is already connecting/connected') {
      logger.error('Failed to connect to Redis', { error: err.message });
      throw err;
    }
  }

  // Initialize cache invalidation pub/sub listener
  await invalidator.init();

  logger.info('All database connections established');
}

export async function disconnectAll(): Promise<void> {
  logger.info('Disconnecting from databases...');

  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL disconnected');
  }

  if (redis) {
    await redis.disconnect();
    redis = null;
    logger.info('Redis disconnected');
  }

  // Disconnect cache invalidation subscriber
  await invalidator.disconnect();
}
