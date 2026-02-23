import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import reactionroleCommand from './core/reactionrole';
import editCommand from './manage/edit';
import removeCommand from './manage/remove';
import listCommand from './manage/list';
import configCommand from './staff/config';
import buttonCommand from './staff/button';
import { reactionRolesEvents } from './events';

const logger = createModuleLogger('ReactionRoles');

const BotModule = {
  name: 'reactionroles',
  displayName: 'Reaction Roles',
  category: 'utility',
  version: '1.0.0',
  description: 'Create interactive reaction role panels with emoji, buttons, or dropdowns',
  author: 'Your Name',

  commands: [
    reactionroleCommand,
    editCommand,
    removeCommand,
    listCommand,
    configCommand,
    buttonCommand,
  ],

  defaultConfig: { enabled: true },

  async onLoad() {
    logger.info('ReactionRoles module loaded — 6 commands');
  },
};

export default BotModule;
