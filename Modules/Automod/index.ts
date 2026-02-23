import { BotModule } from '../../Shared/src/types/command';
import { automodEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { DEFAULT_AUTOMOD_CONFIG } from './helpers';

// Import core commands
import automodView from './core/automod';
import testword from './core/testword';

// Import staff commands
import antispam from './staff/antispam';
import antiraid from './staff/antiraid';
import antilink from './staff/antilink';
import antiinvite from './staff/antiinvite';
import wordfilter from './staff/wordfilter';
import antinuke from './staff/antinuke';
import punishment from './staff/punishment';
import exempt from './staff/exempt';
import automodLog from './staff/log';
import automodToggle from './staff/toggle';

const logger = createModuleLogger('Automod:Module');

/**
 * Automod Module
 * Provides automated moderation with spam detection, raid protection, word filters,
 * link blocking, invite blocking, anti-nuke, and escalating punishments.
 */
export const automodModule: BotModule = {
  name: 'automod',
  displayName: 'Auto Moderation',
  description:
    'Automated moderation with spam detection, raid protection, word filters, link blocking, invite blocking, anti-nuke, and escalating punishments.',
  category: 'moderation',
  version: '1.0.0',
  enabled: true,

  commands: [
    // Core commands
    automodView,
    testword,

    // Staff commands
    antispam,
    antiraid,
    antilink,
    antiinvite,
    wordfilter,
    antinuke,
    punishment,
    exempt,
    automodLog,
    automodToggle,
  ],

  events: automodEvents,

  defaultConfig: DEFAULT_AUTOMOD_CONFIG,

  /**
   * Module initialization hook
   */
  async onLoad() {
    logger.info('Automod module loaded — 12 commands');
  },
};

export default automodModule;
