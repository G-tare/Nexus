import { Client } from 'discord.js';
import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { stickyMessagesEvents } from './events';
import { activityTracker } from './tracker';
import stickCommand from './staff/stick';
import unstickCommand from './staff/unstick';
import stickyeditCommand from './staff/stickyedit';
import stickyConfigCommand from './staff/config';
import type { BotCommand } from '../../Shared/src/types/command';


const logger = createModuleLogger('StickyMessages');

const stickyMessagesModule: BotModule = {
  name: 'stickymessages',
  displayName: 'Sticky Messages',
  category: 'utility',
  description: 'Create sticky messages that re-post automatically',
  version: '1.0.0',
  enabled: true,

  commands: [stickCommand, unstickCommand, stickyeditCommand, stickyConfigCommand],

  defaultConfig: { enabled: true },

  async onLoad(): Promise<void> {
    logger.info('StickyMessages module loaded — 4 commands');
  },

  async onUnload(): Promise<void> {
    try {
      logger.info('Shutting down Sticky Messages module');
      activityTracker.cleanupAll();
      logger.info('Sticky Messages module shut down successfully');
    } catch (error) {
      logger.error(`Failed to shut down Sticky Messages module: ${error}`);
      throw error;
    }
  },
};

export default stickyMessagesModule;
