import { ShardingManager } from 'discord.js';
import path from 'path';
import { config } from '../../Shared/src/config';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('ShardManager');

/**
 * Entry point: ShardingManager spawns bot shards.
 * Each shard runs bot.ts as a separate process.
 * This allows scaling across many guilds (required at 2500+ guilds).
 */
const manager = new ShardingManager(path.join(__dirname, 'bot.ts'), {
  token: config.discord.token,
  totalShards: 'auto', // Discord determines optimal shard count
  respawn: true,
  execArgv: ['-r', 'tsx/cjs'], // Allow TypeScript execution in shards
});

manager.on('shardCreate', (shard) => {
  logger.info(`Shard ${shard.id} launched`);

  shard.on('ready', () => {
    logger.info(`Shard ${shard.id} is ready`);
  });

  shard.on('disconnect', () => {
    logger.warn(`Shard ${shard.id} disconnected`);
  });

  shard.on('reconnecting', () => {
    logger.info(`Shard ${shard.id} reconnecting...`);
  });

  shard.on('death', (process) => {
    logger.error(`Shard ${shard.id} died (PID: ${(process as any).pid})`);
  });

  shard.on('error', (error) => {
    logger.error(`Shard ${shard.id} error`, { error: error.message });
  });
});

async function start() {
  logger.info('Starting Nexus Bot...');
  logger.info(`Environment: ${config.env}`);

  try {
    await manager.spawn({ timeout: 90_000 });
    logger.info(`All shards spawned successfully`);
  } catch (error: any) {
    logger.error('Failed to spawn shards', { error: error.message });
    process.exit(1);
  }
}

start();
