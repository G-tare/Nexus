import { BotModule } from '../../Shared/src/types/command';
import { countingEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import counting from './core/counting';
import stats from './core/stats';
import leaderboard from './core/leaderboard';

// Staff commands
import config from './staff/config';

const logger = createModuleLogger('Counting');

const countingModule: BotModule = {
  name: 'counting',
  displayName: 'Counting',
  description: 'A counting game for servers with lives, streaks, and leaderboards',
  category: 'engagement',

  commands: [
    // Core (3)
    counting,
    stats,
    leaderboard,

    // Staff (1)
    config,
  ],

  events: countingEvents,

  async onLoad() {
    logger.info('Counting module loaded — 4 commands across 2 subdirectories');
  },

  defaultConfig: {
    enabled: true,
    channelId: null,
    allowDoubleCount: false,
    mathEnabled: true,
    defaultLives: 3,
    streakBonusEnabled: true,
    streakBonusInterval: 100,
    streakBonusAmount: 50,
  },
};

export default countingModule;
