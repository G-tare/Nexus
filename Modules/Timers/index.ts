import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { timerEvents } from './events';
import timerCommand from './core/timer';
import timersCommand from './core/list';
import timerCancelCommand from './core/cancel';
import timerCheckCommand from './core/check';
import timersListCommand from './manage/serverlist';
import timerConfigCommand from './staff/config';

const logger = createModuleLogger('Timers');

export const DEFAULT_TIMER_CONFIG = {
  maxPerUser: 5,
  maxDurationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  defaultNotifyChannelId: null as string | null,
  allowDm: true,
  embedColor: '#3498DB',
  logChannelId: null as string | null,
};

export type TimerConfig = typeof DEFAULT_TIMER_CONFIG;

const timersModule: BotModule = {
  name: 'timers',
  displayName: 'Timers',
  description: 'General-purpose countdown timers with channel and DM notifications.',
  category: 'utility',
  enabled: true,
  defaultConfig: DEFAULT_TIMER_CONFIG,
  commands: [
    timerCommand,
    timersCommand,
    timerCancelCommand,
    timerCheckCommand,
    timersListCommand,
    timerConfigCommand,
  ],
  events: timerEvents,
  async onLoad() {
    logger.info('Timers module loaded — 6 commands');
  },
};

export default timersModule;
