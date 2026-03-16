import { BotModule } from '../../Shared/src/types/command';
import { Events } from './events';

import blackjack from './games/blackjack';
import slots from './games/slots';
import crash from './games/crash';
import roulette from './games/roulette';
import coinflip from './games/coinflip';
import poker from './games/poker';
import wheel from './games/wheel';
import scratchcard from './games/scratchcard';
import horserace from './games/horserace';
import highlow from './games/highlow';
import config from './staff/config';

const CasinoModule: BotModule = {
  name: 'casino',
  displayName: 'Casino',
  description: 'Gambling games with currency integration — blackjack, crash, roulette, poker, and more',
  category: 'economy',
  defaultConfig: {
    enabled: true,
    minBet: 10,
    maxBet: 50000,
    currencyType: 'coins',
    cooldown: 10,
    houseEdge: 0.02,
    embedColor: '#FFD700',
    logChannelId: null,
    dailyLossLimit: 0,
    jackpotPool: 0,
  },
  commands: [
    blackjack,
    slots,
    crash,
    roulette,
    coinflip,
    poker,
    wheel,
    scratchcard,
    horserace,
    highlow,
    config,
  ],
  events: Events,
};

export default CasinoModule;
