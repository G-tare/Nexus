import { BotModule } from '../../Shared/src/types/command';
import { scheduledMessagesEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Staff commands
import schedule from './staff/schedule';
import schedulelist from './staff/schedulelist';
import scheduleedit from './staff/scheduleedit';
import scheduledelete from './staff/scheduledelete';
import config from './staff/config';

const logger = createModuleLogger('ScheduledMessages');

const scheduledMessagesModule: BotModule = {
  name: 'scheduledmessages',
  displayName: 'Scheduled Messages',
  description: 'Schedule messages to be sent at specific times or on recurring schedules (staff only)',
  category: 'utility',

  commands: [
    // Staff (5)
    schedule,
    schedulelist,
    scheduleedit,
    scheduledelete,
    config,
  ],

  events: scheduledMessagesEvents,

  async onLoad() {
    logger.info('Scheduled Messages module loaded — 5 commands (staff only)');
  },

  defaultConfig: {
    enabled: true,
    maxScheduledPerGuild: 25,
    timezone: 'UTC',
  },
};

export default scheduledMessagesModule;
