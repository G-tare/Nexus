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
  'currency': 'currency',
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
};

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
        'quarantine', 'unquarantine', 'shadowban', 'unshadowban',
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
        'autoplay', 'filters', 'volume', 'voteskip',
        'lyrics', 'songinfo',
        'queue', 'clear', 'loop', 'move', 'remove', 'shuffle', 'skipto',
      ],
    },
    playlist: {
      description: 'Save and manage playlists',
      commands: ['favorites', 'playlist', 'serverplaylist'],
    },
    dj: {
      description: 'Voice channel control, DJ settings, and music configuration',
      commands: ['join', 'disconnect', 'djrole', 'musicconfig'],
    },
  },
  fun: {
    fun: {
      description: 'Games, random content, jokes, memes and more',
      commands: [
        'trivia', 'rps', 'coinflip', '8ball', 'roll', 'slots',
        'blackjack', 'connect4', 'tictactoe', 'wordle', 'wouldyourather',
        'meme', 'joke', 'fact', 'quote', 'dog', 'cat', 'roast', 'compliment',
        'config',
      ],
    },
    social: {
      description: 'Social interactions — hugs, pats, high-fives and more',
      commands: [
        'hug', 'pat', 'slap', 'kiss', 'highfive', 'bite', 'punch',
        'kick-fun', 'laugh', 'cry', 'pout', 'wave', 'dance', 'boop', 'cuddle', 'poke',
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

    if (splitConfig) {
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
