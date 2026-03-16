import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Search commands
import googleCommand from './search/google';
import youtubeCommand from './search/youtube';
import githubCommand from './search/github';
import npmCommand from './search/npm';
import steamCommand from './search/steam';
import weatherCommand from './search/weather';
import cryptoCommand from './search/crypto';
import translateCommand from './search/translate';
import colorCommand from './search/color';

// Tools commands
import calculatorCommand from './tools/calculator';
import qrcodeCommand from './tools/qrcode';
import passwordCommand from './tools/password';
import encodeCommand from './tools/encode';
import decodeCommand from './tools/decode';
import emojifyCommand from './tools/emojify';
import enlargeCommand from './tools/enlarge';
import anagramCommand from './tools/anagram';
import minecraftCommand from './tools/minecraft';
import pollCommand from './tools/poll';

// Notepad commands
import addCommand from './notepad/add';
import viewCommand from './notepad/view';
import editCommand from './notepad/edit';
import deleteCommand from './notepad/delete';

// Staff commands
import configCommand from './staff/config';

// Events
import { utilitiesEvents } from './events';

// Helpers
import { DEFAULT_UTILITIES_CONFIG } from './helpers';

const logger = createModuleLogger('Utilities');

const utilitiesModule: BotModule = {
  name: 'utilities',
  displayName: 'Utilities',
  description:
    'Search engines, tools, notepad, and general utilities',
  category: 'utility',
  version: '1.0.0',
  enabled: true,

  commands: [
    // Search
    googleCommand,
    youtubeCommand,
    githubCommand,
    npmCommand,
    steamCommand,
    weatherCommand,
    cryptoCommand,
    translateCommand,
    colorCommand,

    // Tools
    calculatorCommand,
    qrcodeCommand,
    passwordCommand,
    encodeCommand,
    decodeCommand,
    emojifyCommand,
    enlargeCommand,
    anagramCommand,
    minecraftCommand,
    pollCommand,

    // Notepad
    addCommand,
    viewCommand,
    editCommand,
    deleteCommand,

    // Staff
    configCommand,
  ],

  events: utilitiesEvents,

  defaultConfig: DEFAULT_UTILITIES_CONFIG,

  async onLoad() {
    logger.info('Utilities module loaded — 28 commands (9 search, 10 tools, 4 notepad, 1 staff)');
  },
};

export default utilitiesModule;
