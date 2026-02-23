import { BotModule } from '../../Shared/src/types/command';
import { backupEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Staff commands
import backupcreate from './staff/backupcreate';
import backuplist from './staff/backuplist';
import backuprestore from './staff/backuprestore';
import backupdelete from './staff/backupdelete';
import backupinfo from './staff/backupinfo';
import backupconfig from './staff/backupconfig';
import backupcompare from './staff/backupcompare';

const logger = createModuleLogger('Backup');

const backupModule: BotModule = {
  name: 'backup',
  displayName: 'Backup',
  description: 'Full server configuration backup and restore — roles, channels, permissions, emojis, settings, and bot configs.',
  category: 'utility',

  commands: [
    // Staff (7)
    backupcreate,
    backuplist,
    backuprestore,
    backupdelete,
    backupinfo,
    backupconfig,
    backupcompare,
  ],

  events: backupEvents,

  async onLoad() {
    logger.info('Backup module loaded — 7 commands');
  },

  defaultConfig: {
    enabled: true,
    autoBackupInterval: 0,
    maxBackups: 10,
    backupOnChange: false,
    changeCooldown: 30,
  },
};

export default backupModule;
