import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { config } from '../config';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('Database');

// ============================================
// PostgreSQL Connection
// ============================================

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error', { error: err.message });
    });

    pool.on('connect', () => {
      logger.debug('New PostgreSQL connection established');
    });
  }
  return pool;
}

export function getDb() {
  return drizzle(getPool());
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
}
