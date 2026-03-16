import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Setup commands
import logs from './setup/logs';
import welcome from './setup/welcome';
import tickets from './setup/tickets';
import fun from './setup/fun';
import music from './setup/music';
import moderation from './setup/moderation';
import leveling from './setup/leveling';
import all from './setup/all';

// Staff commands
import config from './staff/config';

// Events
import { autosetupEvents } from './events';

// Helpers
import { DEFAULT_AUTOSETUP_CONFIG } from './helpers';

const logger = createModuleLogger('Autosetup');

const autosetupModule: BotModule = {
  name: 'autosetup',
  displayName: 'Auto Setup',
  description:
    'One-command server setup wizard — auto-create channels, roles, and configure modules',
  category: 'utility',
  version: '1.0.0',
  enabled: true,

  commands: [
    // Setup (8)
    logs,
    welcome,
    tickets,
    fun,
    music,
    moderation,
    leveling,
    all,

    // Staff (1)
    config,
  ],

  events: autosetupEvents,

  defaultConfig: DEFAULT_AUTOSETUP_CONFIG,

  async onLoad() {
    logger.info('Autosetup module loaded — 9 commands (8 setup, 1 staff)');
  },
};

export default autosetupModule;
