import { ShardingManager } from 'discord.js';
import path from 'path';
import { config } from '../../Shared/src/config';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('ShardManager');

// Respawn tracking — prevent burning through Discord gateway sessions
const MAX_RAPID_DEATHS = 5; // Max crashes before we stop respawning
const RAPID_DEATH_WINDOW = 60_000; // 60s — deaths within this window count as "rapid"
const BACKOFF_DELAYS = [5_000, 15_000, 30_000, 60_000, 120_000]; // Escalating wait times
const shardDeaths: number[] = []; // Timestamps of recent deaths

/**
 * Entry point: ShardingManager spawns bot shards.
 * Each shard runs bot.ts as a separate process.
 * This allows scaling across many guilds (required at 2500+ guilds).
 */
const manager = new ShardingManager(path.join(__dirname, 'bot.ts'), {
  token: config.discord.token,
  totalShards: 'auto', // Discord determines optimal shard count
  respawn: false, // We handle respawn ourselves with backoff
  execArgv: ['-r', 'tsx/cjs'], // Allow TypeScript execution in shards
});

manager.on('shardCreate', (shard) => {
  logger.info(`Shard ${shard.id} launched`);

  shard.on('ready', () => {
    logger.info(`Shard ${shard.id} is ready`);
    // Reset death tracking on successful ready — the bot is healthy
    shardDeaths.length = 0;
  });

  shard.on('disconnect', () => {
    logger.warn(`Shard ${shard.id} disconnected`);
  });

  shard.on('reconnecting', () => {
    logger.info(`Shard ${shard.id} reconnecting...`);
  });

  shard.on('death', (process) => {
    logger.error(`Shard ${shard.id} died (PID: ${(process as any).pid})`);

    const now = Date.now();
    shardDeaths.push(now);

    // Only count deaths within the rapid window
    const recentDeaths = shardDeaths.filter(t => now - t < RAPID_DEATH_WINDOW);
    shardDeaths.length = 0;
    shardDeaths.push(...recentDeaths);

    if (recentDeaths.length >= MAX_RAPID_DEATHS) {
      logger.error(
        `Shard ${shard.id} died ${recentDeaths.length} times in ${RAPID_DEATH_WINDOW / 1000}s — ` +
        `stopping respawn to preserve gateway sessions. Fix the issue and restart manually.`
      );
      return; // Don't respawn — something is fundamentally broken
    }

    const backoffIndex = Math.min(recentDeaths.length - 1, BACKOFF_DELAYS.length - 1);
    const delay = BACKOFF_DELAYS[backoffIndex];

    logger.warn(
      `Respawning shard ${shard.id} in ${delay / 1000}s ` +
      `(death ${recentDeaths.length}/${MAX_RAPID_DEATHS} before circuit breaker)`
    );

    setTimeout(() => {
      shard.respawn().catch((err) => {
        logger.error(`Failed to respawn shard ${shard.id}`, { error: err.message });
      });
    }, delay);
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
    // Don't process.exit — let the process stay alive so tsx watch
    // doesn't restart and burn more gateway sessions
    logger.error('Bot will not restart automatically. Fix the issue and restart manually.');
  }
}

start();
