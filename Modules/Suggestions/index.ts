import { Client, Events } from 'discord.js';
import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Import commands
import suggestCommand from './core/suggest';
import approveCommand from './manage/approve';
import denyCommand from './manage/deny';
import considerCommand from './manage/consider';
import implementCommand from './manage/implement';
import removeCommand from './manage/remove';
import configCommand from './staff/config';

// Import events
import { suggestionsEvents } from './events';

const logger = createModuleLogger('Suggestions');

const suggestionsModule: BotModule = {
  name: 'suggestions',
  displayName: 'Suggestions',
  category: 'engagement',
  description: 'Community suggestion submission and management system',
  version: '1.0.0',
  enabled: true,

  commands: [
    suggestCommand,
    approveCommand,
    denyCommand,
    considerCommand,
    implementCommand,
    removeCommand,
    configCommand,
  ],

  events: suggestionsEvents,

  defaultConfig: { enabled: true },

  async onLoad(): Promise<void> {
    logger.info('Suggestions module loaded — 7 commands');
  },

  async onUnload(): Promise<void> {
    logger.info('Suggestions module unloaded');
  },
};

export default suggestionsModule;
