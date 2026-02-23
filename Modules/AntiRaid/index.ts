import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { antiRaidEvents } from './events';

import lockdownCommand from './staff/lockdown';
import unlockdownCommand from './staff/unlockdown';
import raidstatusCommand from './staff/raidstatus';
import antiraidconfigCommand from './staff/antiraidconfig';

const logger = createModuleLogger('AntiRaid');

const AntiRaidModule: BotModule = {
  name: 'antiraid',
  displayName: 'Anti-Raid',
  category: 'protection',
  description: 'Advanced raid detection and prevention with join velocity tracking, account age checks, and auto-lockdown',

  commands: [lockdownCommand, unlockdownCommand, raidstatusCommand, antiraidconfigCommand],

  events: antiRaidEvents,

  onLoad: async () => {
    logger.info('AntiRaid module loaded successfully');
  },

  defaultConfig: {
    enabled: true,
    joinThreshold: 10,
    joinWindow: 60,
    minAccountAge: 24,
    autoLockdown: true,
    lockdownDuration: 3600,
    massActionThreshold: 5,
    massActionWindow: 60,
    alertChannelId: '',
    quarantineRoleId: '',
    whitelistedRoles: [],
    action: 'quarantine',
    verificationEnabled: true,
    verificationMessage: 'Welcome! Please verify you are human by clicking the button below.',
  },
};

export default AntiRaidModule;
