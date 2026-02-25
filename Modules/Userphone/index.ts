import { BotModule } from '../../Shared/src/types/command';
import { userphoneEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import userphone from './core/userphone';
import hangup from './core/hangup';
import phonebook from './core/phonebook';
import contacts from './core/contacts';
import directcall from './core/directcall';

// Staff commands
import userphoneconfig from './staff/userphoneconfig';

const logger = createModuleLogger('Userphone');

const userphoneModule: BotModule = {
  name: 'userphone',
  displayName: 'Userphone',
  description: 'Cross-server calling system — connect with random servers and chat through the bot with message relay, attachments, call history, and stats.',
  category: 'fun',

  commands: [
    // Core (5)
    userphone,
    hangup,
    phonebook,
    contacts,
    directcall,

    // Staff (1)
    userphoneconfig,
  ],

  events: userphoneEvents,

  async onLoad() {
    logger.info('Userphone module loaded — 6 commands');
  },

  defaultConfig: {
    allowedChannels: [],
    blacklistedServers: [],
    maxDuration: 300,
    allowAttachments: true,
    showServerName: true,
    callCooldown: 30,
    reportChannelId: null,
    contentFilter: {
      blockNSFW: false,
      blockProfanity: false,
      blockLinks: false,
      customBlockedWords: [],
    },
  },
};

export default userphoneModule;
