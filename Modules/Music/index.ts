import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { musicEvents } from './events';

// Import all 30 commands
// Playback commands (10)
import play from './playback/play';
import pause from './playback/pause';
import resume from './playback/resume';
import skip from './playback/skip';
import stop from './playback/stop';
import seek from './playback/seek';
import nowplaying from './playback/nowplaying';
import previous from './playback/previous';
import join from './playback/join';
import disconnect from './playback/disconnect';

// Queue commands (7)
import queue from './queue/queue';
import shuffle from './queue/shuffle';
import loop from './queue/loop';
import remove from './queue/remove';
import move from './queue/move';
import clear from './queue/clear';
import skipto from './queue/skipto';

// Controls (4)
import volume from './controls/volume';
import filters from './controls/filters';
import autoplay from './controls/autoplay';
import voteskip from './controls/voteskip';

// Playlist (3)
import playlist from './playlist/playlist';
import serverplaylist from './playlist/serverplaylist';
import favorites from './playlist/favorites';

// Info (2)
import lyrics from './info/lyrics';
import songinfo from './info/songinfo';

// Staff (3)
import djrole from './staff/djrole';
import musicconfig from './staff/musicconfig';
import forceplay from './staff/forceplay';

const logger = createModuleLogger('Music');

const DEFAULT_MUSIC_CONFIG = {
  // Volume settings
  defaultVolume: 100,
  maxVolume: 150,

  // Queue settings
  maxQueueSize: 500,
  maxDuration: 3600, // 1 hour in seconds

  // Vote skip
  voteSkipEnabled: true,
  voteSkipPercent: 50,

  // Announcements
  announceNowPlaying: false,
  announcementChannelId: null,

  // Autoplay
  autoplayEnabled: false,

  // Server playlists
  serverPlaylistsEnabled: true,

  // DJ system
  djEnabled: false,
  djRoleId: null,
  djOnlyCommands: [] as string[],

  // Leave behavior
  leaveOnEmpty: true,
  leaveOnEmptyDelay: 30,
  leaveOnFinish: false,
  leaveOnFinishDelay: 30,

  // 24/7 mode
  twentyFourSeven: false,
  twentyFourSevenChannelId: null,

  // Channel restrictions
  restrictedTextChannels: [] as string[],
  restrictedVoiceChannels: [] as string[],

  // Loop mode
  loopMode: 'off' as 'off' | 'track' | 'queue',
};

const musicModule: BotModule = {
  name: 'music',
  displayName: 'Music',
  description:
    'Full music system with Lavalink, YouTube/Spotify/SoundCloud/Apple Music, playlists, server playlists, favorites, DJ system, filters, 24/7 mode, vote skip, auto-play, and more.',
  category: 'entertainment',
  version: '1.0.0',
  enabled: true,

  commands: [
    // Playback (10)
    play,
    pause,
    resume,
    skip,
    stop,
    seek,
    nowplaying,
    previous,
    join,
    disconnect,

    // Queue (7)
    queue,
    shuffle,
    loop,
    remove,
    move,
    clear,
    skipto,

    // Controls (4)
    volume,
    filters,
    autoplay,
    voteskip,

    // Playlist (3)
    playlist,
    serverplaylist,
    favorites,

    // Info (2)
    lyrics,
    songinfo,

    // Staff (3)
    djrole,
    musicconfig,
    forceplay,
  ],

  events: musicEvents,

  defaultConfig: DEFAULT_MUSIC_CONFIG,

  async onLoad() {
    logger.info('Music module loaded — 30 commands');
  },
};

export default musicModule;
