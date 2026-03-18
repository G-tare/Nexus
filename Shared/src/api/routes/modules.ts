import { Router, Request, Response } from 'express';
import { moduleConfig } from '../../middleware/moduleConfig';
import { getPool } from '../../database/connection';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('ModulesAPI');
const router = Router();

/**
 * Default configs for each module — returned when no DB row exists yet so
 * the iOS dashboard can display all configurable fields immediately.
 */
const MODULE_DEFAULTS: Record<string, Record<string, any>> = {
  moderation: {
    dmOnBan: true, dmOnKick: true, dmOnMute: true, dmOnWarn: true,
    requireReason: false, appealEnabled: false,
    reputationEnabled: true, defaultReputation: 80,
    reputationPenalties: { warn: 1, mute: 5, kick: 10, tempban: 15, ban: 20 },
    warnAutoMuteEnabled: false, warnAutoMuteCount: 3, warnAutoMuteDuration: 3600,
    warnAutoKickEnabled: false, warnAutoKickCount: 10,
    warnAutoBanEnabled: false, warnAutoBanCount: 20,
    shadowBanEnabled: true, altDetectionEnabled: false,
    altDetectionLogChannelId: null, quarantineRoleId: null,
    watchlistChannelId: null, fineEnabled: false,
    fineAmounts: { warn: 0, mute: 0, kick: 0, ban: 0 },
    appealChannelId: null,
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
  aichatbot: {
    provider: 'groq', model: '', apiKey: '',
    temperature: 0.7, maxTokens: 1500,
    systemPrompt: 'You are a helpful Discord bot assistant.',
    cooldown: 3, maxHistory: 20,
    autoReply: false, mentionReply: true,
    allowedChannels: [],
    agentEnabled: true, triggerPhrase: 'hey nexus',
    confirmDestructive: true, maxToolCalls: 15,
    disabledTools: [], authorizedUsers: [],
  },
};

/**
 * Modules that should be DISABLED by default — must match moduleConfig.ts
 */
const DISABLED_BY_DEFAULT = new Set([
  'automod',
]);

/**
 * GET /api/modules/:guildId
 * Get all module configs for a guild.
 */
router.get('/:guildId', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const configs = await moduleConfig.getAllConfigs(guildId);

    // Merge defaults into every module config so newly-added fields
    // always have a value, even when a DB row already exists.
    for (const [mod, defaults] of Object.entries(MODULE_DEFAULTS)) {
      if (!configs[mod]) {
        configs[mod] = { enabled: !DISABLED_BY_DEFAULT.has(mod), config: { ...defaults } };
      } else {
        // Backfill any keys present in defaults but missing from the stored config
        const stored = configs[mod].config ?? {};
        for (const [key, val] of Object.entries(defaults)) {
          if (stored[key] === undefined) {
            stored[key] = val;
          }
        }
        configs[mod].config = stored;
      }
    }

    // Fetch global toggles and server bans to overlay on module configs
    const pool = getPool();
    const [globalToggles, serverBans] = await Promise.all([
      pool.query('SELECT module_name, enabled, reason, reason_detail FROM global_module_toggles'),
      pool.query('SELECT module_name, reason, reason_detail FROM server_module_bans WHERE guild_id = $1', [guildId]),
    ]);

    const globalMap: Record<string, { enabled: boolean; reason: string | null; reason_detail: string | null }> = {};
    for (const row of globalToggles.rows) {
      globalMap[row.module_name] = row;
    }

    const banMap: Record<string, { reason: string | null; reason_detail: string | null }> = {};
    for (const row of serverBans.rows) {
      banMap[row.module_name] = row;
    }

    // Attach override info to each module config
    const result: Record<string, any> = {};
    for (const [mod, cfg] of Object.entries(configs)) {
      result[mod] = { ...cfg };
      if (globalMap[mod] && !globalMap[mod].enabled) {
        result[mod].globallyDisabled = true;
        result[mod].globalReason = globalMap[mod].reason;
        result[mod].globalReasonDetail = globalMap[mod].reason_detail;
      }
      if (banMap[mod]) {
        result[mod].serverBanned = true;
        result[mod].banReason = banMap[mod].reason;
        result[mod].banReasonDetail = banMap[mod].reason_detail;
      }
    }

    res.json(result);
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
      res.json({ enabled: !DISABLED_BY_DEFAULT.has(moduleName), config: defaults });
      return;
    }
    // Backfill any keys present in defaults but missing from the stored config
    const defaults = MODULE_DEFAULTS[moduleName];
    if (defaults && config.config) {
      for (const [key, val] of Object.entries(defaults)) {
        if (config.config[key] === undefined) {
          config.config[key] = val;
        }
      }
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

    const gid = req.params.guildId as string;
    const mod = req.params.moduleName as string;
    await moduleConfig.setEnabled(gid, mod, enabled);
    const { CacheInvalidator } = await import('../../cache/cacheInvalidator');
    await CacheInvalidator.publish(`modcfg:${gid}:${mod.toLowerCase()}`);
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

    const gid2 = req.params.guildId as string;
    const mod2 = req.params.moduleName as string;

    // Moderation: clamp negative threshold values and validate escalation order
    if (mod2 === 'moderation') {
      const thresholdCountKeys = ['warnAutoMuteCount', 'warnAutoKickCount', 'warnAutoBanCount'];
      for (const key of thresholdCountKeys) {
        if (key in newConfig && typeof newConfig[key] === 'number' && newConfig[key] < 1) {
          newConfig[key] = 1;
        }
      }
      if ('warnAutoMuteDuration' in newConfig && typeof newConfig.warnAutoMuteDuration === 'number' && newConfig.warnAutoMuteDuration < 60) {
        newConfig.warnAutoMuteDuration = 60;
      }

      // Merge with existing config for full validation context
      const existing = await moduleConfig.getModuleConfig(gid2, mod2);
      const merged = { ...(MODULE_DEFAULTS.moderation || {}), ...(existing?.config || {}), ...newConfig };

      // Validate escalation order
      const enabled: Array<{ key: string; count: number }> = [];
      if (merged.warnAutoMuteEnabled && merged.warnAutoMuteCount > 0) enabled.push({ key: 'mute', count: merged.warnAutoMuteCount });
      if (merged.warnAutoKickEnabled && merged.warnAutoKickCount > 0) enabled.push({ key: 'kick', count: merged.warnAutoKickCount });
      if (merged.warnAutoBanEnabled && merged.warnAutoBanCount > 0) enabled.push({ key: 'ban', count: merged.warnAutoBanCount });

      const mute = enabled.find(e => e.key === 'mute');
      const kick = enabled.find(e => e.key === 'kick');
      const ban = enabled.find(e => e.key === 'ban');
      if (mute && kick && mute.count >= kick.count) {
        res.status(400).json({ error: `Auto-Mute threshold (${mute.count}) must be lower than Auto-Kick (${kick.count})` });
        return;
      }
      if (mute && ban && mute.count >= ban.count) {
        res.status(400).json({ error: `Auto-Mute threshold (${mute.count}) must be lower than Auto-Ban (${ban.count})` });
        return;
      }
      if (kick && ban && kick.count >= ban.count) {
        res.status(400).json({ error: `Auto-Kick threshold (${kick.count}) must be lower than Auto-Ban (${ban.count})` });
        return;
      }
    }

    await moduleConfig.updateConfig(gid2, mod2, newConfig);
    const { CacheInvalidator } = await import('../../cache/cacheInvalidator');
    await CacheInvalidator.publish(`modcfg:${gid2}:${mod2.toLowerCase()}`);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Update module config error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PATCH /api/modules/:guildId/:moduleName/commands/:commandName/toggle
 * Enable or disable a specific command within a module.
 */
router.patch('/:guildId/:moduleName/commands/:commandName/toggle', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const moduleName = req.params.moduleName as string;
    const commandName = req.params.commandName as string;
    const { disabled } = req.body;
    if (typeof disabled !== 'boolean') {
      res.status(400).json({ error: 'disabled must be a boolean' });
      return;
    }

    await moduleConfig.setCommandDisabled(guildId, moduleName, commandName, disabled);
    const { CacheInvalidator } = await import('../../cache/cacheInvalidator');
    await CacheInvalidator.publish(`modcfg:${guildId}:${moduleName.toLowerCase()}`);
    res.json({ success: true, disabled });
  } catch (err: any) {
    logger.error('Toggle command error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/modules/:guildId/:moduleName/history
 * Get recent command usage for a specific module in a guild.
 */
router.get('/:guildId/:moduleName/history', async (req: Request, res: Response) => {
  try {
    const { guildId, moduleName } = req.params;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const pool = getPool();
    const result = await pool.query(
      `SELECT cu.command_name, cu.subcommand_name, cu.user_id, cu.execution_ms, cu.success, cu.timestamp,
              COALESCE(u.global_name, u.username, cu.user_id) as display_name
       FROM command_usage cu
       LEFT JOIN users u ON u.id = cu.user_id
       WHERE cu.guild_id = $1 AND cu.module_name = $2
       ORDER BY cu.timestamp DESC
       LIMIT $3`,
      [guildId, moduleName, limit],
    );

    // Also get aggregate stats
    const stats = await pool.query(
      `SELECT
         COUNT(*) as total_uses,
         COUNT(*) FILTER (WHERE success = true) as successful,
         COUNT(*) FILTER (WHERE success = false) as failed,
         ROUND(AVG(execution_ms)) as avg_latency,
         COUNT(DISTINCT user_id) as unique_users,
         COUNT(DISTINCT command_name) as unique_commands
       FROM command_usage
       WHERE guild_id = $1 AND module_name = $2
         AND timestamp > NOW() - INTERVAL '30 days'`,
      [guildId, moduleName],
    );

    res.json({
      history: result.rows,
      stats: stats.rows[0] || {},
    });
  } catch (err: any) {
    logger.error('Get module history error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

export { router as modulesRouter };
