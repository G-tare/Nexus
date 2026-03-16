import { BotModule } from '../../Shared/src/types/command';
import { currencyEvents, setupCurrencyListeners } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { DEFAULT_CURRENCY_CONFIG } from './helpers';

// Core commands
import balance from './core/balance';
import daily from './core/daily';
import weekly from './core/weekly';
import pay from './core/pay';

// Bank commands
import bankDeposit from './bank/deposit';
import bankWithdraw from './bank/withdraw';
import bankBalance from './bank/bankbalance';
import bankSavings from './bank/savings';
import bankCollect from './bank/collect';
import bankUpgrade from './bank/upgrade';

// Earn commands
import earnBeg from './earn/beg';
import earnFish from './earn/fish';
import earnHunt from './earn/hunt';
import earnCrime from './earn/crime';
import earnRob from './earn/rob';
import earnDig from './earn/dig';
import earnSearch from './earn/search';
import earnMonthly from './earn/monthly';

// Jobs commands
import jobApply from './jobs/apply';
import jobWork from './jobs/work';
import jobInfo from './jobs/jobinfo';
import jobQuit from './jobs/quit';
import jobList from './jobs/list';
import jobLeaderboard from './jobs/leaderboard';

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
  description: 'Complete economy system with banking, jobs, earning, and transfers.',
  category: 'economy',

  commands: [
    // Core (4)
    balance,
    daily,
    weekly,
    pay,

    // Bank (6)
    bankDeposit,
    bankWithdraw,
    bankBalance,
    bankSavings,
    bankCollect,
    bankUpgrade,

    // Earn (8)
    earnBeg,
    earnFish,
    earnHunt,
    earnCrime,
    earnRob,
    earnDig,
    earnSearch,
    earnMonthly,

    // Jobs (6)
    jobApply,
    jobWork,
    jobInfo,
    jobQuit,
    jobList,
    jobLeaderboard,

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
    logger.info('Currency module loaded — 38 commands (4 core, 6 bank, 8 earn, 6 jobs, 6 staff, 2 info, 6 other)');
  },

  defaultConfig: {
    ...DEFAULT_CURRENCY_CONFIG,
    banking: true,
    savings: true,
    robbery: true,
    earning: true,
    jobs: true,
    jobSlacking: true,
    slackingThreshold: 20,
    jailDuration: 600,
    crimeMultiplier: 1.0,
    robChance: 40,
    monthlyAmount: 5000,
    monthlyGems: 50,
  },
};

export default currencyModule;
