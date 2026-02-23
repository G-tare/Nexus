import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { pollsEvents } from './events';
import pollCommand from './core/poll';
import quickpollCommand from './core/quickpoll';
import pollendCommand from './manage/end';
import pollresultsCommand from './manage/results';
import pollConfigCommand from './staff/config';

const logger = createModuleLogger('Polls');

const pollsModule: BotModule = {
  name: 'polls',
  displayName: 'Polls',
  description: 'Create and manage polls with customizable voting options and timers.',
  category: 'engagement',

  commands: [
    pollCommand,
    quickpollCommand,
    pollendCommand,
    pollresultsCommand,
    pollConfigCommand,
  ],

  events: pollsEvents,

  async onLoad() {
    logger.info('Polls module loaded — 5 commands');
  },

  defaultConfig: {
    enabled: true,
    maxOptions: 10,
    maxDuration: 604800,
    allowAnonymous: false,
  },
};

export default pollsModule;
