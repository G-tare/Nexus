import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { activityEvents } from './events';

import activityCommand from './core/activity';
import activityLeaderboardCommand from './core/activityleaderboard';
import activityConfigCommand from './staff/activityconfig';
import inactiveListCommand from './staff/inactivelist';

const logger = createModuleLogger('ActivityTracking');

const ActivityTrackingModule: BotModule = {
  name: 'activitytracking',
  displayName: 'Activity Tracking',
  category: 'utility',
  description: 'Tracks member activity including voice time, messages, and reactions',

  commands: [activityCommand, activityLeaderboardCommand, activityConfigCommand, inactiveListCommand],

  events: activityEvents,

  onLoad: async () => {
    logger.info('Activity Tracking module loaded successfully');
  },

  defaultConfig: {
    enabled: true,
    trackVoice: true,
    trackMessages: true,
    trackReactions: true,
    inactiveThresholdDays: 30,
    logChannelId: null,
    excludedChannels: [],
    excludedRoles: [],
    resetOnLeave: false,
    leaderboardSize: 10,
  },
};

export default ActivityTrackingModule;
