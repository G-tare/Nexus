import { BotModule } from '../../Shared/src/types/command';
import { currencyEvents, setupCurrencyListeners } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { DEFAULT_CURRENCY_CONFIG } from './helpers';

// Core commands
import balance from './core/balance';
import daily from './core/daily';
import weekly from './core/weekly';
import pay from './core/pay';

// Staff commands
import give from './staff/give';
import take from './staff/take';
import reset from './staff/reset';
import setbalance from './staff/setbalance';
import config from './staff/config';
import audit from './staff/audit';

// Info commands
import richest from './info/richest';
import economy from './info/economy';

const logger = createModuleLogger('Currency');

const currencyModule: BotModule = {
  name: 'currency',
  displayName: 'Currency & Economy',
  description: 'Server economy system with multiple currency types, daily/weekly rewards, streaks, transfers, and full admin controls.',
  category: 'economy',

  commands: [
    // Core (4)
    balance,
    daily,
    weekly,
    pay,

    // Staff (6)
    give,
    take,
    reset,
    setbalance,
    config,
    audit,

    // Info (2)
    richest,
    economy,
  ],

  events: currencyEvents,

  async onLoad() {
    setupCurrencyListeners();
    logger.info('Currency module loaded — 12 commands (4 core, 6 staff, 2 info)');
  },

  defaultConfig: DEFAULT_CURRENCY_CONFIG,
};

export default currencyModule;
