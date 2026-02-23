import { BotModule } from '../../Shared/src/types/command';
import { inviteTrackerEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Import commands
import invitesCommand from './core/invites';
import leaderboardCommand from './core/leaderboard';
import whoInvitedCommand from './core/who-invited';
import configCommand from './staff/config';
import resetCommand from './staff/reset';
import bonusCommand from './staff/bonus';

const logger = createModuleLogger('InviteTracker');

const inviteTrackerModule: BotModule = {
  name: 'invitetracker',
  displayName: 'Invite Tracker',
  description: 'Track member invites, leaderboards, and manage invite stats.',
  category: 'utility',

  commands: [
    invitesCommand,
    leaderboardCommand,
    whoInvitedCommand,
    configCommand,
    resetCommand,
    bonusCommand,
  ],

  events: inviteTrackerEvents,

  async onLoad() {
    logger.info('InviteTracker module loaded — 6 commands');
  },

  defaultConfig: {
    enabled: true,
    trackJoins: true,
    trackLeaves: true,
    trackFakes: true,
    fakeAccountAgeDays: 7,
    fakeLeaveHours: 24,
    announceJoins: false,
  },
};

export default inviteTrackerModule;
