import { BotModule } from '../../Shared/src/types/command';
import { customCommandsEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Staff commands
import create from './staff/create';
import edit from './staff/edit';
import deleteCmd from './staff/delete';
import list from './staff/list';
import variables from './staff/variables';
import config from './staff/config';

const logger = createModuleLogger('CustomCommands');

const customCommandsModule: BotModule = {
  name: 'customcommands',
  displayName: 'Custom Commands',
  description: 'Create custom commands with variables, embeds, DM responses, and permission controls (staff only)',
  category: 'utility',

  commands: [
    // Staff (6)
    create,
    edit,
    deleteCmd,
    list,
    variables,
    config,
  ],

  events: customCommandsEvents,

  async onLoad() {
    logger.info('Custom Commands module loaded — 6 commands (staff only)');
  },

  defaultConfig: {
    enabled: true,
    prefix: '!',
    maxCommands: 50,
    allowSlash: true,
  },
};

export default customCommandsModule;
