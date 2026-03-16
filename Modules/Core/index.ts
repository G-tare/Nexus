import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Import config registrations (side-effect: populates the registry)
import '../../Shared/src/utils/configRegistrations';

// Commands
import configs from './config/configs';
import help from './help/help';
import reportUser from './report/reportuser';
import reportBug from './report/reportbug';

const logger = createModuleLogger('Core');

const coreModule: BotModule = {
  name: 'core',
  displayName: 'Core',
  description: 'Core bot utilities — configuration dashboard, help system, and user/bug reporting.',
  category: 'utility',
  version: '1.0.0',
  enabled: true,

  commands: [
    configs,
    help,
    reportUser,
    reportBug,
  ],

  defaultConfig: {
    enabled: true,
    reportChannelId: null,
  },

  async onLoad() {
    logger.info('Core module loaded — 4 commands');
  },
};

export default coreModule;
