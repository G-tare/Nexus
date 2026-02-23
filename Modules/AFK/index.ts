import { BotModule } from '../../Shared/src/types/command';
import { afkEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import afk from './core/afk';
import afklist from './core/afklist';

// Staff commands
import config from './staff/config';
import remove from './staff/remove';
import ban from './staff/ban';

const logger = createModuleLogger('AFK');

const afkModule: BotModule = {
  name: 'afk',
  displayName: 'AFK',
  description: 'AFK system with ping tracking and auto-responses',
  category: 'utility',

  commands: [
    // Core (2)
    afk,
    afklist,

    // Staff (3)
    config,
    remove,
    ban,
  ],

  events: afkEvents,

  async onLoad() {
    logger.info('AFK module loaded — 5 commands across 2 subdirectories');
  },

  defaultConfig: {
    enabled: true,
    maxMessageLength: 200,
    dmPingsOnReturn: true,
    maxPingsToTrack: 50,
    autoRemoveOnMessage: true,
    bannedUsers: [],
    logChannelId: null,
  },
};

export default afkModule;
