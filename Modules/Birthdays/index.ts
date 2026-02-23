import { BotModule } from '../../Shared/src/types/command';
import { birthdayEvents, stopBirthdayChecker } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import birthday from './core/birthday';
import birthdayview from './core/birthdayview';
import upcoming from './core/upcoming';
import list from './core/list';

// Staff commands
import config from './staff/config';
import remove from './staff/remove';
import announce from './staff/announce';

const logger = createModuleLogger('Birthdays');

const birthdaysModule: BotModule = {
  name: 'birthdays',
  displayName: 'Birthdays',
  description: 'Birthday tracking with auto-announcements, birthday roles, and DM notifications',
  category: 'social',

  commands: [
    // Core (4)
    birthday,
    birthdayview,
    upcoming,
    list,

    // Staff (3)
    config,
    remove,
    announce,
  ],

  events: birthdayEvents,

  async onLoad() {
    logger.info('Birthdays module loaded — 7 commands across 2 subdirectories');
  },

  async onUnload() {
    stopBirthdayChecker();
    logger.info('Birthdays module unloaded');
  },

  defaultConfig: {
    enabled: true,
    channelId: null,
    roleId: null,
    announcementMessage: '🎂 Happy Birthday {user}! 🎉',
    timezone: 'UTC',
    dmNotification: true,
    showAge: true,
    allowHideYear: true,
  },
};

export default birthdaysModule;
