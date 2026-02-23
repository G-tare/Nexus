import { BotModule } from '../../Shared/src/types/command';
import { reputationEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import rep from './core/rep';
import giverep from './core/giverep';
import repleaderboard from './core/repleaderboard';
import rephistory from './core/rephistory';

// Staff commands
import setrep from './staff/setrep';
import resetrep from './staff/resetrep';
import reproles from './staff/reproles';
import repconfig from './staff/repconfig';

const logger = createModuleLogger('Reputation');

const reputationModule: BotModule = {
  name: 'reputation',
  displayName: 'Reputation',
  description: 'Community reputation/karma system with upvotes, leaderboards, rep-gated roles, decay, and cross-module integration.',
  category: 'engagement',

  commands: [
    // Core (4)
    rep,
    giverep,
    repleaderboard,
    rephistory,

    // Staff (4)
    setrep,
    resetrep,
    reproles,
    repconfig,
  ],

  events: reputationEvents,

  async onLoad() {
    logger.info('Reputation module loaded — 8 commands');
  },

  defaultConfig: {
    defaultRep: 0,
    giveCooldown: 3600,
    globalCooldown: 60,
    dailyLimit: 5,
    decayEnabled: false,
    decayAfterDays: 30,
    decayAmount: 1,
    decayFloor: 0,
    upvoteEmoji: '⬆️',
    downvoteEmoji: '⬇️',
    reactionRepEnabled: false,
    logChannelId: null,
    allowSelfRep: false,
    allowNegative: false,
  },
};

export default reputationModule;
