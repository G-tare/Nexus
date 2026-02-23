import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { quoteBoardEvents } from './events';
import boardCommand from './core/board';
import randomCommand from './core/random';
import configCommand from './staff/config';

const logger = createModuleLogger('QuoteBoard');

const quoteboardModule: BotModule = {
  name: 'quoteboard',
  displayName: 'Quote Board',
  description: 'Automatically repost messages to dedicated boards based on emoji reactions.',
  category: 'engagement',

  commands: [boardCommand, randomCommand, configCommand],

  events: quoteBoardEvents,

  async onLoad() {
    logger.info('QuoteBoard module loaded — 3 commands');
  },

  defaultConfig: {
    enabled: true,
    boards: [],
    defaultThreshold: 3,
    defaultEmoji: '⭐',
    selfStar: false,
    ignoreBots: true,
  },
};

export default quoteboardModule;
