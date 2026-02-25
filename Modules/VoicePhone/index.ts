import { BotModule } from '../../Shared/src/types/command';
import { voicephoneEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import voicecall from './core/voicecall';

// Staff commands
import voicephoneconfig from './staff/voicephoneconfig';

const logger = createModuleLogger('VoicePhone');

const voicephoneModule: BotModule = {
  name: 'voicephone',
  displayName: 'Voice Phone',
  description: 'Cross-server voice calling — connect voice channels between servers for real-time audio relay with multi-speaker mixing.',
  category: 'social',

  commands: [
    // Core (1 command, 5 subcommands: start, hangup, status, appeal, appealstatus)
    voicecall,

    // Staff (1 command, 17 subcommands: view, channel, blacklist, duration, bitrate, maxspeakers, showserver, reportchannel, cooldown, minsize, requirecommunity, maxstrikes, strikeban, appeals, appealresolve, unban, stats)
    voicephoneconfig,
  ],

  events: voicephoneEvents,

  async onLoad() {
    logger.info('VoicePhone module loaded — 2 commands (22 subcommands)');
  },

  defaultConfig: {
    allowedChannels: [],
    blacklistedServers: [],
    maxDuration: 600,
    callCooldown: 60,
    maxSpeakersPerSide: 5,
    bitrate: 64000,
    showServerName: true,
    reportChannelId: null,
    minServerSize: 50,
    requireCommunity: true,
    maxStrikes: 3,
    strikeBanDuration: 3600,
  },
};

export default voicephoneModule;
