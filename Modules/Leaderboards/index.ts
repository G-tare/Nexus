import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { leaderboardsEvents } from './events';
import leaderboardCommand from './core/leaderboard';
import topCommand from './core/top';
import configCommand from './staff/config';

const logger = createModuleLogger('Leaderboards');

const leaderboardsModule: BotModule = {
  name: 'leaderboards',
  displayName: 'Leaderboards',
  description: 'View server leaderboards for XP, currency, messages, invites, voice time, and more.',
  category: 'engagement',

  commands: [
    leaderboardCommand,
    topCommand,
    configCommand,
  ],

  events: leaderboardsEvents,

  async onLoad() {
    logger.info('Leaderboards module loaded — 3 commands');
  },

  defaultConfig: {
    enabled: true,
    defaultType: 'xp',
    entriesPerPage: 10,
    rankCardEnabled: true,
  },
};

export default leaderboardsModule;
