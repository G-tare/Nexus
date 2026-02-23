import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { tempVoiceEvents } from './events';

// Import commands
import vc from './core/vc';
import vcname from './core/vcname';
import vclimit from './core/vclimit';
import vclock from './core/vclock';
import vcpermit from './core/vcpermit';
import vckick from './core/vckick';
import vcinfo from './core/vcinfo';
import vcconfig from './staff/config';
import vcban from './staff/ban';
import vcunban from './staff/unban';
import vcforceclose from './staff/forceclose';

const logger = createModuleLogger('TempVoice');

const tempVoiceModule: BotModule = {
  name: 'tempvoice',
  displayName: 'Temp Voice',
  description: 'Temporary voice channels that users can create, customize, and manage.',
  category: 'utility',

  commands: [
    vc,
    vcname,
    vclimit,
    vclock,
    vcpermit,
    vckick,
    vcinfo,
    vcconfig,
    vcban,
    vcunban,
    vcforceclose,
  ],

  events: tempVoiceEvents,

  async onLoad() {
    logger.info('TempVoice module loaded — 11 commands');
  },

  defaultConfig: {
    enabled: true,
    categoryId: null,
    lobbyChannelId: null,
    defaultUserLimit: 0,
    defaultBitrate: 64000,
    nameTemplate: '{user}\'s Channel',
  },
};

export default tempVoiceModule;
