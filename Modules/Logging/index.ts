import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { loggingEvents } from './events';
import { DEFAULT_LOGGING_CONFIG } from './helpers';

// Core commands
import logsCommand from './core/logs';

// Staff commands
import logchannelCommand from './staff/logchannel';
import logignoreCommand from './staff/logignore';
import logtoggleCommand from './staff/logtoggle';
import logconfigCommand from './staff/logconfig';

const logger = createModuleLogger('Logging');

/**
 * Logging Module
 *
 * Comprehensive server logging system with support for:
 * - 25+ event types (messages, members, channels, roles, server, voice, moderation, etc.)
 * - Per-event logging channel routing
 * - Before/after diffs for all changes
 * - Granular ignore lists (users, channels, roles)
 * - Audit log integration for action attribution
 * - Full message content preservation for deletions
 * - Bulk delete formatting with all message details
 */

const loggingModule: BotModule = {
  name: 'logging',
  displayName: 'Logging',
  description:
    'Comprehensive server logging with 25+ event types, per-type channel routing, before/after diffs, and granular ignore lists.',
  category: 'moderation',
  version: '1.0.0',
  enabled: true,

  commands: [
    // Core commands
    logsCommand,
    // Staff commands
    logchannelCommand,
    logignoreCommand,
    logtoggleCommand,
    logconfigCommand,
  ],

  events: loggingEvents,

  defaultConfig: DEFAULT_LOGGING_CONFIG,

  async onLoad() {
    logger.info('Logging module loaded — 5 commands');
  },
};

export default loggingModule;
