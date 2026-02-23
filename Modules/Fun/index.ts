import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Game commands
import trivia from './games/trivia/trivia';
import rps from './games/rps/rps';
import coinflip from './games/coinflip/coinflip';
import eightball from './games/8ball/8ball';
import roll from './games/roll/roll';
import slots from './games/slots/slots';
import blackjack from './games/blackjack/blackjack';
import connect4 from './games/connect4/connect4';
import tictactoe from './games/tictactoe/tictactoe';
import wordle from './games/wordle/wordle';
import wouldyourather from './games/wouldyourather/wouldyourather';

// Random commands
import meme from './random/meme/meme';
import joke from './random/joke/joke';
import fact from './random/fact/fact';
import quote from './random/quote/quote';
import dog from './random/dog/dog';
import cat from './random/cat/cat';
import roast from './random/roast/roast';
import compliment from './random/compliment/compliment';

// Interaction commands
import hug from './interact/hug';
import pat from './interact/pat';
import slap from './interact/slap';
import kiss from './interact/kiss';
import highfive from './interact/highfive';
import bite from './interact/bite';
import punch from './interact/punch';
import kick from './interact/kick';
import laugh from './interact/laugh';
import cry from './interact/cry';
import pout from './interact/pout';
import wave from './interact/wave';
import dance from './interact/dance';
import boop from './interact/boop';
import cuddle from './interact/cuddle';
import poke from './interact/poke';

// Staff commands
import config from './staff/config';

// Events
import { funEvents } from './events';

const logger = createModuleLogger('Fun');

/**
 * Fun Module - Games, random content, and user interactions
 */
export const funModule: BotModule = {
  name: 'fun',
  displayName: 'Fun',
  category: 'entertainment',
  description: 'Games, random content, and user interactions',
  version: '1.0.0',
  enabled: true,

  commands: [
    // Games (11)
    trivia,
    rps,
    coinflip,
    eightball,
    roll,
    slots,
    blackjack,
    connect4,
    tictactoe,
    wordle,
    wouldyourather,

    // Random (8)
    meme,
    joke,
    fact,
    quote,
    dog,
    cat,
    roast,
    compliment,

    // Interactions (16)
    hug,
    pat,
    slap,
    kiss,
    highfive,
    bite,
    punch,
    kick,
    laugh,
    cry,
    pout,
    wave,
    dance,
    boop,
    cuddle,
    poke,

    // Staff (1)
    config,
  ],

  events: funEvents,

  async onLoad() {
    logger.info('Fun module loaded');
  },

  defaultConfig: {
    enabled: true,
  },
};

export default funModule;
