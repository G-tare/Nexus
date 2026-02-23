import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { formsEvents } from './events';

// Import commands
import formCommand from './core/form';
import responsesCommand from './core/responses';
import configCommand from './staff/config';
import createCommand from './staff/create';
import editCommand from './staff/edit';
import deleteCommand from './staff/delete';
import toggleCommand from './staff/toggle';
import reviewCommand from './staff/review';

const logger = createModuleLogger('Forms');

const formsModule: BotModule = {
  name: 'forms',
  displayName: 'Forms',
  description: 'Create custom forms with questions, submissions, and review workflows.',
  category: 'utility',

  commands: [
    formCommand,
    responsesCommand,
    configCommand,
    createCommand,
    editCommand,
    deleteCommand,
    toggleCommand,
    reviewCommand,
  ],

  events: formsEvents,

  async onLoad() {
    logger.info('Forms module loaded — 8 commands');
  },

  defaultConfig: {
    enabled: true,
    forms: [],
    submissionChannelId: null,
    requireApproval: false,
  },
};

export default formsModule;
