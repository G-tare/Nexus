import { BotModule, BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('CommandGrouper');

// Discord API option type constants
const SUB_COMMAND = 1;
const SUB_COMMAND_GROUP = 2;

// ============================================
// Module name → slash command slug mapping
// (for modules that are NOT split)
// ============================================

const MODULE_SLUG_MAP: Record<string, string> = {
  'afk': 'afk',
  'aichatbot': 'ai',
  'activitytracking': 'activity',
  'antiraid': 'antiraid',
  'autoroles': 'autoroles',
  'automod': 'automod',
  'backup': 'backup',
  'birthdays': 'birthdays',
  'colorroles': 'colors',
  'confessions': 'confessions',
  'counting': 'counting',
  // currency moved to MODULE_SPLITS (too many commands for single slug)
  'customcommands': 'customcmds',
  'forms': 'forms',
  'giveaways': 'giveaways',
  'invitetracker': 'invites',
  'leaderboards': 'leaderboards',
  'leveling': 'leveling',
  'logging': 'logging',
  'messagetracking': 'snipe',
  'polls': 'polls',
  'quoteboard': 'quoteboard',
  'reactionroles': 'reactionroles',
  'reminders': 'reminders',
  'reputation': 'rep',
  'scheduledmessages': 'schedule',
  'shop': 'shop',
  'statschannels': 'stats',
  'stickymessages': 'sticky',
  'suggestions': 'suggestions',
  'tempvoice': 'vc',
  'tickets': 'tickets',
  'translation': 'translate',
  'userphone': 'userphone',
  'welcome': 'welcome',
  'raffles': 'raffles',
  'donationtracking': 'donations',
  'timers': 'timers',
  'casino': 'casino',
  'profile': 'profile',
  'family': 'family',
  'images': 'images',
  'soundboard': 'soundboard',
  'autosetup': 'autosetup',
};

// ============================================
// STANDALONE COMMANDS
//
// Modules listed here register each of their
// commands as TOP-LEVEL slash commands (no
// parent wrapper, no subcommand nesting).
// e.g. /configs, /help
// ============================================

const STANDALONE_MODULES = new Set<string>(['core']);

// ============================================
// MODULE SPLITS
//
// Large modules (>25 commands) get split into
// multiple parent commands with FLAT subcommands.
// No subcommand groups = no 3-level nesting.
//
// e.g. /mod ban @user  instead of  /mod ban ban @user
//      /music play     instead of  /music playback play
// ============================================

interface SplitEntry {
  commands: string[];
  description: string;
}

const MODULE_SPLITS: Record<string, Record<string, SplitEntry>> = {
  moderation: {
    mod: {
      description: 'Core moderation — bans, kicks, mutes, warnings, purges and more',
      commands: [
        'ban', 'unban', 'tempban', 'kick', 'softban',
        'mute', 'unmute', 'warn', 'unwarn', 'warnings', 'clearwarnings',
        'purge', 'purgeuser', 'purgebot', 'purgehuman',
        'slowmode', 'lock', 'unlock', 'lockdown', 'unlockdown', 'nuke',
        'nickname', 'role', 'userinfo',
      ],
    },
    modlog: {
      description: 'Case management, investigation, mass actions and advanced moderation',
      commands: [
        'case', 'modstats', 'history', 'note', 'notes',
        'massban', 'massmute', 'mutelist', 'banlist', 'serverwarns', 'bulkdelete',
        'quarantine', 'unquarantine', 'shadowban', 'unshadowban', 'autokick', 'unautokick',
        'altdetect', 'watchlist',
        'addreputation', 'removereputation', 'setreputation', 'reputationhistory',
      ],
    },
  },
  music: {
    music: {
      description: 'Play music, control playback, manage the queue and more',
      commands: [
        'play', 'forceplay', 'pause', 'resume', 'skip', 'stop', 'previous', 'seek', 'nowplaying',
        'autoplay', 'volume', 'voteskip',
        'lyrics', 'songinfo',
        'queue', 'clear', 'loop', 'move', 'remove', 'shuffle', 'skipto',
      ],
    },
    effects: {
      description: 'Audio effects and filters for music playback',
      commands: ['8d', 'bassboost', 'lofi', 'karaoke', 'nightcore', 'lowpass', 'timescale', 'vaporwave', 'slowmo', 'clearfilter'],
    },
    playlist: {
      description: 'Save and manage playlists',
      commands: ['favorites', 'playlist', 'serverplaylist'],
    },
    dj: {
      description: 'Voice channel control, DJ settings, and music configuration',
      commands: ['join', 'disconnect', 'djrole', 'musicconfig'],
    },
    radio: {
      description: 'Live radio streaming in voice channels',
      commands: ['radio-play', 'radio-stop', 'radio-list'],
    },
  },
  currency: {
    currency: {
      description: 'Balance, daily, weekly, monthly rewards and transfers',
      commands: [
        'balance', 'daily', 'weekly', 'pay', 'richest', 'economy',
      ],
    },
    bank: {
      description: 'Banking — deposits, withdrawals, savings accounts and upgrades',
      commands: [
        'bank-deposit', 'bank-withdraw', 'bank-balance', 'bank-savings', 'bank-collect', 'bank-upgrade',
      ],
    },
    earn: {
      description: 'Earn currency — beg, fish, hunt, crime, rob, dig, search and more',
      commands: [
        'earn-beg', 'earn-fish', 'earn-hunt', 'earn-crime', 'earn-rob',
        'earn-dig', 'earn-search', 'earn-monthly',
      ],
    },
    job: {
      description: 'Jobs — apply for work, complete shifts, and climb the career ladder',
      commands: [
        'job-apply', 'job-work', 'job-info', 'job-quit', 'job-list', 'job-leaderboard',
      ],
    },
    'currency-staff': {
      description: 'Currency administration — give, take, reset, config and audit',
      commands: [
        'currency-give', 'currency-take', 'currency-reset', 'currency-setbalance',
        'currency-config', 'currency-audit',
      ],
    },
  },
  fun: {
    fun: {
      description: 'Classic games — trivia, connect4, wordle, memes and more',
      commands: [
        'trivia', 'rps', '8ball', 'roll',
        'connect4', 'tictactoe', 'wordle', 'wouldyourather',
        'meme', 'joke', 'fact', 'quote', 'dog', 'cat', 'roast', 'compliment',
      ],
    },
    games: {
      description: 'New games — snake, hangman, duel, memory, reaction and more',
      commands: [
        'guess', 'hangman', 'tord', 'wordchain', 'snake', 'fasttype',
        'memory', 'reaction', 'mathrace', 'scramble', 'quizbowl',
        'puzzle', 'duel', 'discord-activity',
      ],
    },
    social: {
      description: 'Social interactions — hugs, pats, high-fives and more',
      commands: [
        'hug', 'pat', 'slap', 'kiss', 'highfive', 'bite', 'punch',
        'kick-fun', 'laugh', 'cry', 'pout', 'wave', 'dance', 'boop', 'cuddle', 'poke',
      ],
    },
    extras: {
      description: 'Fun extras — ASCII art, shipping, hacking, animal facts and more',
      commands: [
        'ascii', 'say', 'reverse', 'emojify', 'rate', 'ship', 'hack',
        'birdfact', 'pandafact', 'fox',
      ],
    },
  },
  utilities: {
    utils: {
      description: 'Search, tools, and notepad utilities',
      commands: [
        'google', 'youtube', 'github', 'npm', 'steam', 'weather', 'crypto', 'util-translate', 'utilities-colorinfo',
        'calculator', 'qrcode', 'password', 'encode', 'decode',
      ],
    },
    'utils-tools': {
      description: 'More tools — emojify, enlarge, anagram, minecraft, notepad and quick polls',
      commands: [
        'util-emojify', 'enlarge', 'anagram', 'minecraft', 'utilities-quickpoll',
        'notepad-add', 'notepad-view', 'notepad-edit', 'notepad-delete',
      ],
    },
  },
};

// ============================================
// Result types
// ============================================

export interface GrouperResult {
  /** JSON command data for Discord API registration */
  registrationData: any[];
  /** Maps route keys to BotCommand handlers */
  routingMap: Map<string, BotCommand>;
  /** Maps command slug → module name for reverse lookup */
  slugToModule: Map<string, string>;
}

// ============================================
// Helper functions
// ============================================

function getModuleKey(moduleName: string): string {
  return moduleName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getModuleSlug(moduleName: string): string {
  const key = getModuleKey(moduleName);
  return MODULE_SLUG_MAP[key] || key.slice(0, 32);
}

function hasSubcommands(cmdJson: any): boolean {
  return cmdJson.options?.some((opt: any) =>
    opt.type === SUB_COMMAND || opt.type === SUB_COMMAND_GROUP,
  ) ?? false;
}

function isStaffCommand(cmd: BotCommand): boolean {
  return cmd.permissionPath?.includes('.staff.') ?? false;
}

/** Sort options: required before non-required (Discord API requirement) */
function sortOptions(options: any[]): any[] {
  return [...options].sort((a, b) => {
    const aReq = a.required ? 0 : 1;
    const bReq = b.required ? 0 : 1;
    return aReq - bReq;
  });
}

/** Convert a simple command to subcommand format */
function toSubcommand(cmdJson: any): any {
  const options = sortOptions(
    (cmdJson.options || []).filter((o: any) => o.type > SUB_COMMAND_GROUP),
  );

  return {
    type: SUB_COMMAND,
    name: cmdJson.name.slice(0, 32),
    description: (cmdJson.description || 'No description').slice(0, 100),
    options,
  };
}

/** Convert a command with subcommands to a subcommand group */
function toSubcommandGroup(cmdJson: any): any {
  const subcommands = (cmdJson.options || [])
    .filter((o: any) => o.type === SUB_COMMAND)
    .map((sub: any) => ({
      ...sub,
      options: sortOptions(sub.options || []),
    }));

  return {
    type: SUB_COMMAND_GROUP,
    name: cmdJson.name,
    description: (cmdJson.description || 'No description').slice(0, 100),
    options: subcommands,
  };
}

// ============================================
// Main grouper function
// ============================================

export function groupModuleCommands(modules: Map<string, BotModule>): GrouperResult {
  const registrationData: any[] = [];
  const routingMap = new Map<string, BotCommand>();
  const slugToModule = new Map<string, string>();

  for (const [, module] of modules) {
    const moduleKey = getModuleKey(module.name);
    const splitConfig = MODULE_SPLITS[moduleKey];

    if (STANDALONE_MODULES.has(moduleKey)) {
      processStandaloneModule(module, registrationData, routingMap, slugToModule);
    } else if (splitConfig) {
      processSplitModule(module, splitConfig, registrationData, routingMap, slugToModule);
    } else {
      processNormalModule(module, registrationData, routingMap, slugToModule);
    }
  }

  logger.info(`Grouped ${modules.size} modules into ${registrationData.length} parent commands, ${routingMap.size} routes`);

  return { registrationData, routingMap, slugToModule };
}

// ============================================
// SPLIT MODULE — multiple parent commands,
// all with flat subcommands (no nesting)
// ============================================

function processSplitModule(
  module: BotModule,
  splitConfig: Record<string, SplitEntry>,
  registrationData: any[],
  routingMap: Map<string, BotCommand>,
  slugToModule: Map<string, string>,
): void {
  // Index all commands by name
  const staffCommands: BotCommand[] = [];
  const coreByName = new Map<string, BotCommand>();

  for (const cmd of module.commands) {
    if (isStaffCommand(cmd)) {
      staffCommands.push(cmd);
    } else {
      coreByName.set(cmd.data.name, cmd);
    }
  }

  // Track claimed commands to catch stragglers
  const claimed = new Set<string>();

  for (const [slug, cfg] of Object.entries(splitConfig)) {
    slugToModule.set(slug, module.name);

    const parentCommand: any = {
      name: slug,
      description: cfg.description.slice(0, 100),
      options: [],
    };

    for (const cmdName of cfg.commands) {
      const cmd = coreByName.get(cmdName);
      if (!cmd) continue;
      claimed.add(cmdName);

      const cmdJson = (cmd.data as any).toJSON();

      if (hasSubcommands(cmdJson)) {
        // Command already has its own subcommands → make it a subcommand group
        const group = toSubcommandGroup(cmdJson);
        parentCommand.options.push(group);
        for (const sub of group.options) {
          routingMap.set(`${slug}:${cmdJson.name}:${sub.name}`, cmd);
        }
      } else {
        // Flat subcommand — the clean path: /mod ban, /music play, etc.
        parentCommand.options.push(toSubcommand(cmdJson));
        routingMap.set(`${slug}::${cmdJson.name}`, cmd);
      }
    }

    if (parentCommand.options.length > 25) {
      logger.error(`Split /${slug} from ${module.displayName} has ${parentCommand.options.length} options (max 25) — TRUNCATING to 25!`);
      parentCommand.options = parentCommand.options.slice(0, 25);
    }

    if (parentCommand.options.length > 0) {
      registrationData.push(parentCommand);
    }
  }

  // Warn about unclaimed commands
  for (const [name] of coreByName) {
    if (!claimed.has(name)) {
      logger.warn(`Command "${name}" in ${module.displayName} not assigned to any split — add it to MODULE_SPLITS`);
    }
  }

  // Staff commands go on whichever slug matches the old MODULE_SLUG_MAP entry
  const moduleKey = getModuleKey(module.name);
  const mainSlug = (MODULE_SLUG_MAP[moduleKey] && splitConfig[MODULE_SLUG_MAP[moduleKey]])
    ? MODULE_SLUG_MAP[moduleKey]
    : Object.keys(splitConfig)[0];

  const mainParent = registrationData.find((r) => r.name === mainSlug);
  if (mainParent && staffCommands.length > 0) {
    addStaffCommands(mainParent, staffCommands, mainSlug, module.displayName, routingMap);
  }
}

// ============================================
// STANDALONE MODULE — each command registers
// as its own top-level slash command
// ============================================

function processStandaloneModule(
  module: BotModule,
  registrationData: any[],
  routingMap: Map<string, BotCommand>,
  slugToModule: Map<string, string>,
): void {
  for (const cmd of module.commands) {
    const cmdJson = (cmd.data as any).toJSON();
    const name = cmdJson.name;

    // Register as a top-level command (raw JSON, no subcommand wrapping)
    registrationData.push(cmdJson);
    slugToModule.set(name, module.name);

    // Route key for top-level commands: "name::"
    routingMap.set(`${name}::`, cmd);
  }
}

// ============================================
// NORMAL MODULE — single parent command
// ============================================

function processNormalModule(
  module: BotModule,
  registrationData: any[],
  routingMap: Map<string, BotCommand>,
  slugToModule: Map<string, string>,
): void {
  const slug = getModuleSlug(module.name);
  slugToModule.set(slug, module.name);

  const parentCommand: any = {
    name: slug,
    description: module.description.slice(0, 100),
    options: [],
  };

  const coreCommands: BotCommand[] = [];
  const staffCommands: BotCommand[] = [];

  for (const cmd of module.commands) {
    if (isStaffCommand(cmd)) {
      staffCommands.push(cmd);
    } else {
      coreCommands.push(cmd);
    }
  }

  for (const cmd of coreCommands) {
    const cmdJson = (cmd.data as any).toJSON();

    if (hasSubcommands(cmdJson)) {
      const group = toSubcommandGroup(cmdJson);
      parentCommand.options.push(group);
      for (const sub of group.options) {
        routingMap.set(`${slug}:${cmdJson.name}:${sub.name}`, cmd);
      }
    } else {
      parentCommand.options.push(toSubcommand(cmdJson));
      routingMap.set(`${slug}::${cmdJson.name}`, cmd);
    }
  }

  addStaffCommands(parentCommand, staffCommands, slug, module.displayName, routingMap);

  if (parentCommand.options.length > 25) {
    logger.error(`Module ${module.displayName} (/${slug}) has ${parentCommand.options.length} top-level options (max 25) — TRUNCATING to 25!`);
    parentCommand.options = parentCommand.options.slice(0, 25);
  }

  registrationData.push(parentCommand);
}

// ============================================
// STAFF COMMANDS — shared helper
// ============================================

function addStaffCommands(
  parentCommand: any,
  staffCommands: BotCommand[],
  slug: string,
  displayName: string,
  routingMap: Map<string, BotCommand>,
): void {
  if (staffCommands.length === 0) return;

  const simpleStaff: BotCommand[] = [];
  const complexStaff: BotCommand[] = [];

  for (const cmd of staffCommands) {
    const cmdJson = (cmd.data as any).toJSON();
    if (hasSubcommands(cmdJson)) {
      complexStaff.push(cmd);
    } else {
      simpleStaff.push(cmd);
    }
  }

  for (const cmd of complexStaff) {
    const cmdJson = (cmd.data as any).toJSON();
    const group = toSubcommandGroup(cmdJson);
    parentCommand.options.push(group);
    for (const sub of group.options) {
      routingMap.set(`${slug}:${cmdJson.name}:${sub.name}`, cmd);
    }
  }

  if (simpleStaff.length > 0) {
    const staffGroup: any = {
      type: SUB_COMMAND_GROUP,
      name: 'staff',
      description: `Staff commands for ${displayName}`,
      options: [],
    };

    for (const cmd of simpleStaff) {
      const cmdJson = (cmd.data as any).toJSON();
      staffGroup.options.push(toSubcommand(cmdJson));
      routingMap.set(`${slug}:staff:${cmdJson.name}`, cmd);
    }

    parentCommand.options.push(staffGroup);
  }
}
