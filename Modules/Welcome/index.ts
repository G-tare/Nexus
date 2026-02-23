import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import welcometest from './core/welcometest';
import membercount from './core/membercount';

// Staff commands
import welcome from './staff/welcome';
import leave from './staff/leave';
import dm from './staff/dm';
import autorole from './staff/autorole';
import greet from './staff/greet';
import screening from './staff/screening';
import joingate from './staff/joingate';
import welcomeConfig from './staff/config';

// Events
import { welcomeEvents } from './events';

// Helpers
import { DEFAULT_WELCOME_CONFIG } from './helpers';

const logger = createModuleLogger('Welcome');

const welcomeModule: BotModule = {
  name: 'welcome',
  displayName: 'Welcome',
  description:
    'Customizable welcome/leave messages, autoroles, DMs, member screening, join gates, and first-message greetings.',
  category: 'engagement',
  version: '1.0.0',
  enabled: true,

  commands: [
    // Core commands
    welcometest,
    membercount,
    // Staff commands
    welcome,
    leave,
    dm,
    autorole,
    greet,
    screening,
    joingate,
    welcomeConfig,
  ],

  events: welcomeEvents,

  defaultConfig: DEFAULT_WELCOME_CONFIG,

  async onLoad() {
    logger.info('Welcome module loaded — 11 commands');
  },
};

export default welcomeModule;
