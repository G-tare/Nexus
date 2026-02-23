import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { reminderEvents } from './events';
import remindCommand from './core/remind';
import remindersCommand from './core/reminders';
import cancelCommand from './core/cancel';
import snoozeCommand from './core/snooze';
import repeatCommand from './core/repeat';

const logger = createModuleLogger('Reminders');

const remindersModule: BotModule = {
  name: 'reminders',
  displayName: 'Reminders',
  description: 'Set personal reminders with snooze, repeat, and management features.',
  category: 'utility',

  commands: [
    remindCommand,
    remindersCommand,
    cancelCommand,
    snoozeCommand,
    repeatCommand,
  ],

  events: reminderEvents,

  async onLoad() {
    logger.info('Reminders module loaded — 5 commands');
  },

  defaultConfig: {
    enabled: true,
    maxReminders: 25,
    maxRepeat: 100,
  },
};

export default remindersModule;
