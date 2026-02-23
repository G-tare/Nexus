import { BotModule } from '../../Shared/src/types/command';
import { autoRolesEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import myroles from './core/myroles';

// Staff commands
import autoroleadd from './staff/autoroleadd';
import autoroledelete from './staff/autoroledelete';
import autorolelist from './staff/autorolelist';
import autoroleedit from './staff/autoroleedit';
import autoroleclear from './staff/autoroleclear';
import autoroleconfig from './staff/autoroleconfig';

const logger = createModuleLogger('AutoRoles');

const autoRolesModule: BotModule = {
  name: 'autoroles',
  displayName: 'Auto Roles',
  description: 'Automatically assign roles on join with conditions (account age, avatar, bot/human, invite code, boost), delayed assignment, and persistent role restore on rejoin.',
  category: 'utility',

  commands: [
    // Core (1)
    myroles,

    // Staff (6)
    autoroleadd,
    autoroledelete,
    autorolelist,
    autoroleedit,
    autoroleclear,
    autoroleconfig,
  ],

  events: autoRolesEvents,

  async onLoad() {
    logger.info('AutoRoles module loaded — 7 commands');
  },

  defaultConfig: {
    persistentRoles: false,
    ignoreBots: true,
    logChannelId: null,
    stackRoles: true,
    maxDelay: 86400,
  },
};

export default autoRolesModule;
