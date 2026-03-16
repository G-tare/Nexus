import { BotModule } from '../../Shared/src/types/command';
import { scheduledMessagesEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Staff commands
import schedule from './staff/schedule';
import schedulelist from './staff/schedulelist';
import scheduleedit from './staff/scheduleedit';
import scheduledelete from './staff/scheduledelete';
import announce from './staff/announce';
import config from './staff/config';

const logger = createModuleLogger('Announcements');

const scheduledMessagesModule: BotModule = {
  name: 'scheduledmessages',
  displayName: 'Announcements',
  description: 'Send instant announcements or schedule messages to be sent at specific times or on recurring schedules (staff only)',
  category: 'utility',

  commands: [
    // Staff (6)
    announce,
    schedule,
    schedulelist,
    scheduleedit,
    scheduledelete,
    config,
  ],

  events: scheduledMessagesEvents,

  async onLoad() {
    logger.info('Announcements module loaded — 6 commands (staff only)');
  },

  defaultConfig: {
    enabled: true,
    maxScheduledPerGuild: 25,
    timezone: 'UTC',
  },
};

export default scheduledMessagesModule;
