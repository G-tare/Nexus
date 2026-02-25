import { Router, Request, Response } from 'express';
import { moduleConfig } from '../../middleware/moduleConfig';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('ModulesAPI');
const router = Router();

/**
 * Default configs for each module — returned when no DB row exists yet so
 * the iOS dashboard can display all configurable fields immediately.
 */
const MODULE_DEFAULTS: Record<string, Record<string, any>> = {
  moderation: {
    dmOnBan: false, dmOnKick: false, dmOnMute: false, dmOnWarn: true,
    autoDeleteModCommands: false, muteRoleId: null, modLogChannelId: null,
    appealUrl: null, banMessageDeleteDays: 0,
  },
  automod: {
    antiSpam: false, antiSpamThreshold: 5, antiSpamInterval: 5,
    antiLinks: false, allowedLinks: [], blockedWords: [],
    antiCaps: false, capsThreshold: 70, antiInvites: false,
    antiMassMention: false, massMentionThreshold: 5,
    warnThreshold: 3, warnAction: 'mute', logChannelId: null,
    exemptRoles: [], exemptChannels: [],
  },
  leveling: {
    xpPerMessage: { min: 15, max: 25 }, xpCooldownSeconds: 60,
    xpPerVoiceMinute: 5, voiceRequireUnmuted: true,
    xpEnabledChannels: [], xpDisabledChannels: [],
    roleMultipliers: {}, noXpRoles: [],
    announceType: 'current', announceChannelId: null,
    announceMessage: 'Congratulations {user}! You\'ve reached **Level {level}**!',
    levelRoles: [], stackRoles: true,
    doubleXpActive: false, doubleXpExpiresAt: null,
    prestigeEnabled: false, prestigeMaxLevel: 100, prestigeXpMultiplier: 0.05,
    defaultCardStyle: 'default',
  },
  welcome: {
    welcome: {
      enabled: false, channelId: null,
      message: 'Welcome to **{server}**, {user}! You are member #{membercount}.',
      useEmbed: true, embedColor: '#5865F2', embedTitle: 'Welcome!',
      embedFooter: '', embedThumbnail: true, showImage: false,
    },
    leave: {
      enabled: false, channelId: null,
      message: '**{username}** has left the server. We now have {membercount} members.',
      useEmbed: true, embedColor: '#ED4245', embedTitle: 'Goodbye!',
    },
    dm: { enabled: false, message: 'Welcome to **{server}**! Please read the rules.', useEmbed: false },
    autorole: { enabled: false, roles: [], delaySeconds: 0, botRoles: [] },
    greet: { enabled: false, message: 'Welcome {user}, thanks for chatting!' },
    screening: { enabled: false, message: 'Please react or use /verify to gain access.' },
    joingate: { enabled: false, minAccountAgeDays: 7, action: 'kick', logKicks: true },
  },
  tickets: {
    categoryId: null, logChannelId: null, supportRoles: [],
    maxOpenTickets: 3, closeConfirmation: true,
    transcriptOnClose: true, dmTranscript: false,
    autoCloseHours: 0, inactiveHours: 0,
    namingScheme: 'ticket-{number}',
    panels: [],
  },
  logging: {
    logChannelId: null,
    messageDelete: true, messageEdit: true, messageBulkDelete: true,
    memberJoin: true, memberLeave: true, memberUpdate: true,
    roleCreate: true, roleDelete: true, roleUpdate: true,
    channelCreate: true, channelDelete: true, channelUpdate: true,
    voiceJoin: true, voiceLeave: true, voiceMove: true,
    banAdd: true, banRemove: true,
    ignoredChannels: [], ignoredRoles: [],
  },
  activitytracking: {
    trackVoice: true, trackMessages: true, trackReactions: true,
    inactiveThresholdDays: 30, logChannelId: null,
    excludedChannels: [], excludedRoles: [],
    resetOnLeave: false, leaderboardSize: 10,
  },
  userphone: {
    allowedChannels: [], blacklistedServers: [],
    maxDuration: 300, allowAttachments: true,
    showServerName: true, callCooldown: 30,
    reportChannelId: null,
    contentFilter: {
      blockNSFW: false, blockProfanity: false,
      blockLinks: false, customBlockedWords: [],
    },
  },
  music: {
    djRoleId: null, defaultVolume: 80, maxQueueSize: 100,
    allowFilters: true, voteSkipThreshold: 50,
    autoplay: false, leaveOnEmpty: true,
    leaveOnEmptyDelay: 300, announceNowPlaying: true,
    announceChannelId: null, allowedChannels: [],
    maxSongDuration: 600, restrictToVC: false,
  },
  colorroles: {
    maxColors: 1, allowCustomHex: true, requireRole: null,
    reactionLists: [],
  },
  tempvoice: {
    hubChannelId: null, categoryId: null,
    defaultLimit: 0, namingScheme: '{user}\'s Channel',
    allowRename: true, allowLimit: true, allowLock: true,
    allowBitrate: false, inactivityTimeout: 300,
  },
  currency: {
    currencyName: 'coins', currencySymbol: '🪙',
    dailyAmount: 100, weeklyAmount: 500,
    startingBalance: 0, maxBalance: 1000000,
    shopEnabled: true, gamblingEnabled: true,
    robbingEnabled: false, transferEnabled: true,
    transferTax: 0,
  },
  antiraid: {
    joinThreshold: 10, joinInterval: 10,
    action: 'lockdown', logChannelId: null,
    autoLockdownDuration: 300,
    minAccountAge: 7, whitelistedRoles: [],
  },
  backup: {
    autoBackup: false, autoBackupInterval: 86400,
    maxBackups: 5, includeMessages: false,
    includeRoles: true, includeChannels: true,
    includeEmojis: true, includeBans: false,
  },
  statschannels: {
    channels: [],
    updateInterval: 300,
  },
  messagetracking: {
    trackEdits: true, trackDeletes: true,
    logChannelId: null, ignoredChannels: [],
    retentionDays: 30,
  },
};

/**
 * GET /api/modules/:guildId
 * Get all module configs for a guild.
 */
router.get('/:guildId', async (req: Request, res: Response) => {
  try {
    const configs = await moduleConfig.getAllConfigs(req.params.guildId as string);

    // Merge defaults for any modules that don't have a DB row yet
    for (const [mod, defaults] of Object.entries(MODULE_DEFAULTS)) {
      if (!configs[mod]) {
        configs[mod] = { enabled: true, config: defaults };
      }
    }

    res.json(configs);
  } catch (err: any) {
    logger.error('Get modules error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/modules/:guildId/:moduleName
 * Get config for a specific module.
 */
router.get('/:guildId/:moduleName', async (req: Request, res: Response) => {
  try {
    const moduleName = req.params.moduleName as string;
    const config = await moduleConfig.getModuleConfig(req.params.guildId as string, moduleName);
    if (!config) {
      // Return default config so the dashboard can display all fields
      const defaults = MODULE_DEFAULTS[moduleName] ?? {};
      res.json({ enabled: true, config: defaults });
      return;
    }
    res.json(config);
  } catch (err: any) {
    logger.error('Get module config error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PATCH /api/modules/:guildId/:moduleName/toggle
 * Enable or disable a module.
 */
router.patch('/:guildId/:moduleName/toggle', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }

    await moduleConfig.setEnabled(req.params.guildId as string, req.params.moduleName as string, enabled);
    res.json({ success: true, enabled });
  } catch (err: any) {
    logger.error('Toggle module error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PUT /api/modules/:guildId/:moduleName/config
 * Update module configuration.
 */
router.put('/:guildId/:moduleName/config', async (req: Request, res: Response) => {
  try {
    const { config: newConfig } = req.body;
    if (!newConfig || typeof newConfig !== 'object') {
      res.status(400).json({ error: 'config must be an object' });
      return;
    }

    await moduleConfig.updateConfig(req.params.guildId as string, req.params.moduleName as string, newConfig);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Update module config error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

export { router as modulesRouter };
