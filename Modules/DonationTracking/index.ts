import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { donationEvents } from './events';

// Import commands
import donateCommand from './core/donate';
import leaderboardCommand from './core/leaderboard';
import progressCommand from './core/progress';
import mydonationsCommand from './core/mydonations';
import goalCommand from './manage/goal';
import listCommand from './manage/list';
import configCommand from './staff/config';
import resetCommand from './staff/reset';

const logger = createModuleLogger('DonationTracking');

export const DEFAULT_DONATION_CONFIG = {
  defaultChannelId: null as string | null,
  currencyType: 'coins',
  goalAmount: 0,
  goalName: '',
  goalActive: false,
  announceMilestones: true,
  milestonePercents: [25, 50, 75, 100],
  leaderboardSize: 10,
  minDonation: 1,
  maxDonation: 50000,
  embedColor: '#2ECC71',
  logChannelId: null as string | null,
};

const donationTrackingModule: BotModule = {
  name: 'donationtracking',
  displayName: 'Donation Tracking',
  description: 'Track server donations with goals, leaderboards, milestones, and campaign support.',
  category: 'economy',
  enabled: true,
  defaultConfig: DEFAULT_DONATION_CONFIG,
  commands: [
    donateCommand,
    leaderboardCommand,
    progressCommand,
    mydonationsCommand,
    goalCommand,
    listCommand,
    configCommand,
    resetCommand,
  ],
  events: donationEvents,
  async onLoad() {
    logger.info('DonationTracking module loaded — 8 commands');
  },
};

export default donationTrackingModule;
