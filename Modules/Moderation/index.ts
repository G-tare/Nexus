import { BotModule } from '../../Shared/src/types/command';
import { moderationEvents, setupWarnThresholdListener } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Ban commands
import ban from './ban/ban';
import unban from './ban/unban';
import tempban from './ban/tempban';
import massban from './ban/massban';
import banlist from './ban/banlist';

// Mute commands
import mute from './mute/mute';
import unmute from './mute/unmute';
import mutelist from './mute/mutelist';
import massmute from './mute/massmute';

// Kick commands
import kick from './kick/kick';

// Warn commands
import warn from './warn/warn';
import warnings from './warn/warnings';
import unwarn from './warn/unwarn';
import clearwarnings from './warn/clearwarnings';
import serverwarns from './warn/serverwarns';

// Channel commands
import slowmode from './channel/slowmode';
import lock from './channel/lock';
import unlock from './channel/unlock';
import lockdown from './channel/lockdown';
import unlockdown from './channel/unlockdown';
import nuke from './channel/nuke';

// Purge commands
import purge from './purge/purge';
import purgeuser from './purge/purgeuser';
import purgebot from './purge/purgebot';
import purgehuman from './purge/purgehuman';
import bulkdelete from './purge/bulkdelete';

// User commands
import nickname from './user/nickname';
import role from './user/role';
import softban from './user/softban';

// Advanced commands
import shadowban from './advanced/shadowban';
import unshadowban from './advanced/unshadowban';
import quarantine from './advanced/quarantine';
import unquarantine from './advanced/unquarantine';
import autokick from './advanced/autokick';
import unautokick from './advanced/unautokick';

// Investigation commands
import altdetect from './investigation/altdetect';
import watchlist from './investigation/watchlist';

// Utility commands
import caseCmd from './utils/case';
import modstats from './utils/modstats';
import history from './utils/history';
import note from './utils/note';
import notes from './utils/notes';

// User info
import userinfo from './userinfo/userinfo';

// Reputation commands
import addreputation from './reputation/addreputation';
import removereputation from './reputation/removereputation';
import setreputation from './reputation/setreputation';
import reputationhistory from './reputation/reputationhistory';

const logger = createModuleLogger('Moderation');

const moderationModule: BotModule = {
  name: 'moderation',
  displayName: 'Moderation',
  description: 'Comprehensive moderation toolkit with bans, kicks, mutes, warnings, shadow bans, quarantine, alt detection, watchlist, reputation system, and more.',
  category: 'moderation',

  commands: [
    // Ban (5)
    ban,
    unban,
    tempban,
    massban,
    banlist,

    // Mute (4)
    mute,
    unmute,
    mutelist,
    massmute,

    // Kick (1)
    kick,

    // Warn (5)
    warn,
    warnings,
    unwarn,
    clearwarnings,
    serverwarns,

    // Channel (6)
    slowmode,
    lock,
    unlock,
    lockdown,
    unlockdown,
    nuke,

    // Purge (5)
    purge,
    purgeuser,
    purgebot,
    purgehuman,
    bulkdelete,

    // User (3)
    nickname,
    role,
    softban,

    // Advanced (6)
    shadowban,
    unshadowban,
    quarantine,
    unquarantine,
    autokick,
    unautokick,

    // Investigation (2)
    altdetect,
    watchlist,

    // Utils (5)
    caseCmd,
    modstats,
    history,
    note,
    notes,

    // User Info (1)
    userinfo,

    // Reputation (4)
    addreputation,
    removereputation,
    setreputation,
    reputationhistory,
  ],

  events: moderationEvents,

  async onLoad() {
    logger.info('Moderation module loaded — 47 commands across 10 subdirectories');
    // Setup warn threshold listener needs client reference,
    // handled via event bus in events.ts
  },

  defaultConfig: {
    dmOnBan: true,
    dmOnKick: true,
    dmOnMute: true,
    dmOnWarn: true,
    requireReason: false,
    warnThresholds: [],
    appealEnabled: false,
    fineEnabled: false,
    fineAmounts: { warn: 0, mute: 0, kick: 0, ban: 0 },
    reputationEnabled: true,
    defaultReputation: 100,
    reputationPenalties: { warn: 5, mute: 10, kick: 15, ban: 25 },
    shadowBanEnabled: true,
    altDetectionEnabled: false,
    altDetectionLogChannelId: null,
    altDetectionKeywords: ['my alt', 'this is my alt', 'my other account', 'alt account', 'second account'],
    watchlistChannelId: null,
    quarantineRoleId: null,
  },
};

export default moderationModule;
