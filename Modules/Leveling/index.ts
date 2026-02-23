import { BotModule } from '../../Shared/src/types/command';
import { levelingEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { DEFAULT_LEVELING_CONFIG } from './helpers';

// Core commands
import rank from './core/rank';
import levels from './core/levels';
import rewards from './core/rewards';

// Staff commands
import setlevel from './staff/setlevel';
import setxp from './staff/setxp';
import resetxp from './staff/resetxp';
import config from './staff/config';
import levelroles from './staff/levelroles';
import xpmultiplier from './staff/xpmultiplier';
import noxproles from './staff/noxproles';
import doublexp from './staff/doublexp';

// Customize commands
import cardstyle from './customize/cardstyle';
import cardbg from './customize/cardbg';

const logger = createModuleLogger('Leveling');

const levelingModule: BotModule = {
  name: 'leveling',
  displayName: 'Leveling',
  description:
    'XP-based leveling system with rank cards, level roles, voice XP, double XP events, prestige, and customizable card styles.',
  category: 'engagement',

  commands: [
    // Core commands (3)
    rank,
    levels,
    rewards,

    // Staff commands (8)
    setlevel,
    setxp,
    resetxp,
    config,
    levelroles,
    xpmultiplier,
    noxproles,
    doublexp,

    // Customize commands (2)
    cardstyle,
    cardbg,
  ],

  events: levelingEvents,

  async onLoad() {
    logger.info('Leveling module loaded — 13 commands with message/voice XP, level roles, and customization');
  },

  defaultConfig: DEFAULT_LEVELING_CONFIG,
};

export default levelingModule;
