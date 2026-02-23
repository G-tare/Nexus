import { Client } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { getRedis } from '../../Shared/src/database/connection';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Fun');

/**
 * Optional: Clean up expired cooldowns on bot startup
 */
async function onClientReady(client: Client): Promise<void> {
  try {
    logger.info('Fun module initialized');
    // Optional: Could add periodic cleanup of Redis cooldown keys here
  } catch (error) {
    logger.error('Error during Fun module initialization', error);
  }
}

/**
 * Fun module events - minimal setup
 * Most event handling is delegated to individual command files
 */
export const funEvents: ModuleEvent[] = [];
