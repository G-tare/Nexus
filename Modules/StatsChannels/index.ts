import { BotModule } from '../../Shared/src/types/command';
import { statsChannelsEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Staff commands
import statscreate from './staff/statscreate';
import statsdelete from './staff/statsdelete';
import statslist from './staff/statslist';
import statsedit from './staff/statsedit';
import statsconfig from './staff/statsconfig';

const logger = createModuleLogger('StatsChannels');

const statsChannelsModule: BotModule = {
  name: 'statschannels',
  displayName: 'Stats Channels',
  description: 'Auto-updating voice channels that display server statistics like member count, boosts, online members, and more.',
  category: 'utility',

  commands: [
    // Staff (5)
    statscreate,
    statsdelete,
    statslist,
    statsedit,
    statsconfig,
  ],

  events: statsChannelsEvents,

  async onLoad() {
    logger.info('StatsChannels module loaded — 5 commands');
  },

  defaultConfig: {
    enabled: true,
    updateInterval: 300,
    categoryName: '📊 Server Stats',
    numberFormat: 'full',
    goalTarget: 1000,
    goalStatType: 'members',
  },
};

export default statsChannelsModule;
