import { BotModule } from '../../Shared/src/types/command';
import { ticketEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  DEFAULT_TICKET_CONFIG,
  TicketCategory,
  TicketPanel,
  TicketConfig,
  TicketData,
} from './helpers';

// Core commands
import ticket from './commands/core/ticket';
import close from './commands/core/close';

// Panel commands
import ticketpanel from './commands/panel/ticketpanel';
import paneledit from './commands/panel/paneledit';
import panellist from './commands/panel/panellist';

// Manage commands
import add from './commands/manage/add';
import remove from './commands/manage/remove';
import claim from './commands/manage/claim';
import unclaim from './commands/manage/unclaim';
import transfer from './commands/manage/transfer';
import priority from './commands/manage/priority';
import rename from './commands/manage/rename';

// Transcript commands
import transcript from './commands/transcript/transcript';
import transcriptlog from './commands/transcript/transcriptlog';

// Staff commands
import config from './commands/staff/config';
import staffrole from './commands/staff/staffrole';
import feedback from './commands/staff/feedback';
import stats from './commands/staff/stats';

const logger = createModuleLogger('Tickets');

const ticketsModule: BotModule = {
  name: 'tickets',
  displayName: 'Tickets',
  description:
    'Support ticket system with customizable panels, categories, transcripts, claim system, priority levels, feedback ratings, and auto-close.',
  category: 'utility',

  commands: [
    // Core commands (2)
    ticket,
    close,

    // Panel commands (3)
    ticketpanel,
    paneledit,
    panellist,

    // Manage commands (7)
    add,
    remove,
    claim,
    unclaim,
    transfer,
    priority,
    rename,

    // Transcript commands (2)
    transcript,
    transcriptlog,

    // Staff commands (4)
    config,
    staffrole,
    feedback,
    stats,
  ],

  events: ticketEvents,

  async onLoad() {
    logger.info(
      'Tickets module loaded — 18 commands with panels, categories, transcripts, claiming, priorities, feedback, and auto-close'
    );
  },

  defaultConfig: DEFAULT_TICKET_CONFIG,
};

export default ticketsModule;

// Re-export types for external use
export type { TicketCategory, TicketPanel, TicketConfig, TicketData };
