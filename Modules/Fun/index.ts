import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Game commands (existing)
import trivia from './games/trivia/trivia';
import rps from './games/rps/rps';
import eightball from './games/8ball/8ball';
import roll from './games/roll/roll';
import connect4 from './games/connect4/connect4';
import tictactoe from './games/tictactoe/tictactoe';
import wordle from './games/wordle/wordle';
import wouldyourather from './games/wouldyourather/wouldyourather';

// Game commands (new)
import guess from './games/guess/guess';
import hangman from './games/hangman/hangman';
import tord from './games/tord/tord';
import wordchain from './games/wordchain/wordchain';
import snake from './games/snake/snake';
import reaction from './games/reaction/reaction';
import fasttype from './games/fasttype/fasttype';
import memory from './games/memory/memory';
import mathrace from './games/mathrace/mathrace';
import scramble from './games/scramble/scramble';
import quizbowl from './games/quizbowl/quizbowl';
import puzzle from './games/puzzle/puzzle';
import duel from './games/duel/duel';
import activity from './games/activity/activity';

// Random commands (existing)
import meme from './random/meme/meme';
import joke from './random/joke/joke';
import fact from './random/fact/fact';
import quote from './random/quote/quote';
import dog from './random/dog/dog';
import cat from './random/cat/cat';
import roast from './random/roast/roast';
import compliment from './random/compliment/compliment';

// Random commands (new)
import ascii from './random/ascii/ascii';
import say from './random/say/say';
import reverse from './random/reverse/reverse';
import emojify from './random/emojify/emojify';
import rate from './random/rate/rate';
import ship from './random/ship/ship';
import hack from './random/hack/hack';
import birdfact from './random/birdfact/birdfact';
import pandafact from './random/pandafact/pandafact';
import fox from './random/fox/fox';

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
    // Games (22 total — blackjack, slots, coinflip, highlow are in Casino with betting)
    // Existing (7 — blackjack, slots, coinflip, highlow moved to Casino module)
    trivia,
    rps,
    eightball,
    roll,
    connect4,
    tictactoe,
    wordle,
    wouldyourather,
    // New (14)
    guess,
    hangman,
    tord,
    wordchain,
    snake,
    reaction,
    fasttype,
    memory,
    mathrace,
    scramble,
    quizbowl,
    puzzle,
    duel,
    activity,

    // Random (18 total)
    // Existing (8)
    meme,
    joke,
    fact,
    quote,
    dog,
    cat,
    roast,
    compliment,
    // New (10)
    ascii,
    say,
    reverse,
    emojify,
    rate,
    ship,
    hack,
    birdfact,
    pandafact,
    fox,

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
