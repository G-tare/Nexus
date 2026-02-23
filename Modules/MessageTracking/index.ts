import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { messageTrackingEvents } from './events';

import snipeCommand from './core/snipe';
import editsnipeCommand from './core/editsnipe';
import messagetrackConfigCommand from './staff/messagetrackconfig';

const logger = createModuleLogger('MessageTracking');

const MessageTrackingModule: BotModule = {
  name: 'messagetracking',
  displayName: 'Message Tracking',
  category: 'utility',
  description: 'Track and log message edits, deletes, ghost pings, and provide message snipe functionality',

  commands: [snipeCommand, editsnipeCommand, messagetrackConfigCommand],

  events: messageTrackingEvents,

  onLoad: async () => {
    logger.info('Message Tracking module loaded successfully');
  },

  defaultConfig: {
    enabled: true,
    logEdits: true,
    logDeletes: true,
    logBulkDeletes: true,
    ghostPingAlert: true,
    snipeEnabled: true,
    snipeTimeout: 300,
    logChannelId: null,
    ignoredChannels: [],
    ignoreBots: true,
  },
};

export default MessageTrackingModule;
