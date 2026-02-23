import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { giveawayEvents } from './events';

// Core commands
import giveawayCommand from './core/giveaway';
import enterCommand from './core/enter';

// Manage commands
import endCommand from './manage/end';
import rerollCommand from './manage/reroll';
import pauseCommand from './manage/pause';
import cancelCommand from './manage/cancel';
import editCommand from './manage/edit';
import listCommand from './manage/list';

// Bonus commands
import bonusEntryCommand from './bonus/bonusentry';
import requirementCommand from './bonus/requirement';

// Staff commands
import configCommand from './staff/config';
import scheduleCommand from './staff/schedule';
import dropCommand from './staff/drop';

const logger = createModuleLogger('Giveaways');

export const DEFAULT_GIVEAWAY_CONFIG = {
  defaultChannel: null,
  reactionEmoji: '🎉',
  buttonMode: true,
  dmWinners: true,
  pingRole: null,
  embedColor: '#2f3136',
  endAction: 'edit' as const,
  maxActive: 10,
  allowSelfEntry: false,
};

const giveawaysModule: BotModule = {
  name: 'giveaways',
  displayName: 'Giveaways',
  description:
    'Full giveaway system with requirements, bonus entries, drops, scheduling, reactions, buttons, and more.',
  category: 'engagement',
  enabled: true,
  defaultConfig: DEFAULT_GIVEAWAY_CONFIG,

  commands: [
    // Core
    giveawayCommand,
    enterCommand,
    // Manage
    endCommand,
    rerollCommand,
    pauseCommand,
    cancelCommand,
    editCommand,
    listCommand,
    // Bonus
    bonusEntryCommand,
    requirementCommand,
    // Staff
    configCommand,
    scheduleCommand,
    dropCommand,
  ],

  events: giveawayEvents,

  async onLoad() {
    logger.info('Giveaways module loaded — 16 commands');
  },
};

export default giveawaysModule;
