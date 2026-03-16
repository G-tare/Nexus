import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { raffleEvents } from './events';

// Core commands
import raffleCommand from './core/raffle';
import enterCommand from './core/enter';
import myTicketsCommand from './core/mytickets';
import infoCommand from './core/info';

// Manage commands
import endCommand from './manage/end';
import cancelCommand from './manage/cancel';
import listCommand from './manage/list';

// Staff commands
import configCommand from './staff/config';

const logger = createModuleLogger('Raffles');

export const DEFAULT_RAFFLE_CONFIG = {
  defaultChannelId: null as string | null,
  ticketPrice: 100,
  currencyType: 'coins',
  maxTicketsPerUser: 10,
  maxActive: 10,
  dmWinners: true,
  pingRoleId: null as string | null,
  embedColor: '#FF6B35',
  refundOnCancel: true,
};

const rafflesModule: BotModule = {
  name: 'raffles',
  displayName: 'Raffles',
  description: 'Ticket-based raffle system with currency integration, multiple tickets, and automatic drawings.',
  category: 'engagement',
  enabled: true,
  defaultConfig: DEFAULT_RAFFLE_CONFIG,

  commands: [
    // Core
    raffleCommand,
    enterCommand,
    myTicketsCommand,
    infoCommand,
    // Manage
    endCommand,
    cancelCommand,
    listCommand,
    // Staff
    configCommand,
  ],

  events: raffleEvents,

  async onLoad() {
    logger.info('Raffles module loaded — 8 commands');
  },
};

export default rafflesModule;
