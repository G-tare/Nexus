import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import play from './core/play';
import list from './core/list';
import random from './core/random';

// Manage commands
import add from './manage/add';
import remove from './manage/remove';
import rename from './manage/rename';

// Staff commands
import config from './staff/config';

// Events
import { soundboardEvents } from './events';

// Helpers
import { DEFAULT_SOUNDBOARD_CONFIG } from './helpers';

const logger = createModuleLogger('Soundboard');

const soundboardModule: BotModule = {
  name: 'soundboard',
  displayName: 'Soundboard',
  description:
    'Play sound effects in voice channels with preset and custom sounds',
  category: 'fun',
  version: '1.0.0',
  enabled: true,

  commands: [
    // Core (3)
    play,
    list,
    random,

    // Manage (3)
    add,
    remove,
    rename,

    // Staff (1)
    config,
  ],

  events: soundboardEvents,

  defaultConfig: DEFAULT_SOUNDBOARD_CONFIG,

  async onLoad() {
    logger.info('Soundboard module loaded — 7 commands (3 core, 3 manage, 1 staff)');
  },
};

export default soundboardModule;
