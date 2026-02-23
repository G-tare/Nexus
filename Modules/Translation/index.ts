import { BotModule } from '../../Shared/src/types/command';
import { translationEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import translate from './core/translate';
import translatelast from './core/translatelast';
import languages from './core/languages';

// Staff commands
import translatechannel from './staff/translatechannel';
import translateremove from './staff/translateremove';
import translateconfig from './staff/translateconfig';

const logger = createModuleLogger('Translation');

const translationModule: BotModule = {
  name: 'translation',
  displayName: 'Translation',
  description: 'Auto-translate messages in channels, translate on demand, flag emoji reactions for quick translation, and per-channel language configuration.',
  category: 'utility',

  commands: [
    // Core (3)
    translate,
    translatelast,
    languages,

    // Staff (3)
    translatechannel,
    translateremove,
    translateconfig,
  ],

  events: translationEvents,

  async onLoad() {
    logger.info('Translation module loaded — 6 commands');
  },

  defaultConfig: {
    provider: 'google',
    libreUrl: 'http://localhost:5000',
    libreApiKey: '',
    flagReactions: true,
    autoDetect: true,
    defaultLanguage: 'en',
    useWebhooks: true,
    minLength: 2,
    maxLength: 2000,
    userCooldown: 5,
  },
};

export default translationModule;
