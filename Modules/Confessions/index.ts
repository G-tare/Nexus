import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { confessionsEvents } from './events';

// Import commands
import confessCommand from './core/confess';
import approveCommand from './manage/approve';
import denyCommand from './manage/deny';
import banCommand from './manage/ban';
import configCommand from './staff/config';
import revealCommand from './staff/reveal';

const logger = createModuleLogger('Confessions');

const confessionsModule: BotModule = {
  name: 'confessions',
  displayName: 'Confessions',
  description: 'Anonymous confession system with moderation and anonymity controls.',
  category: 'engagement',

  commands: [
    confessCommand,
    approveCommand,
    denyCommand,
    banCommand,
    configCommand,
    revealCommand,
  ],

  events: confessionsEvents,

  async onLoad() {
    logger.info('Confessions module loaded — 6 commands');
  },

  defaultConfig: {
    enabled: true,
    channelId: null,
    requireApproval: false,
    allowImages: false,
    bannedUsers: [],
  },
};

export default confessionsModule;
