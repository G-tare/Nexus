import { ModuleEvent } from '../../Shared/src/types/command';
import { Events, Client } from 'discord.js';
import { getDb } from '../../Shared/src/database/connection';
import { timers } from '../../Shared/src/database/models/schema';
import { eq, and, lte } from 'drizzle-orm';
import { endTimer } from './helpers';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Timers:Events');

/**
 * Check for expired timers and end them
 */
async function checkExpiredTimers(client: Client): Promise<void> {
  const db = getDb();
  try {
    const expired = await db
      .select()
      .from(timers)
      .where(and(eq(timers.isActive, true), lte(timers.endsAt, new Date())));

    for (const timer of expired) {
      try {
        await endTimer(timer, client);
      } catch (error) {
        logger.error(`Failed to end timer ${timer.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Failed to check expired timers:', error);
  }
}

export const timerEvents: ModuleEvent[] = [
  {
    name: 'clientReady',
    event: Events.ClientReady,
    once: true,
    async handler(client: Client) {
      // Check expired timers every 15 seconds
      setInterval(() => checkExpiredTimers(client), 15_000);
      logger.info('Timer expiration checker started');
    },
  },
];
