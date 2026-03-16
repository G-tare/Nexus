import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import propose from './core/propose';
import adopt from './core/adopt';
import divorce from './core/divorce';
import disown from './core/disown';
import tree from './core/tree';

// Info commands
import partner from './info/partner';
import children from './info/children';
import family from './info/family';

// Staff commands
import familyConfig from './staff/config';

// Events
import { familyEvents } from './events';

const logger = createModuleLogger('Family');

export const familyModule: BotModule = {
  name: 'family',
  displayName: 'Family',
  description: 'Build family trees with marriage, adoption, and relationship tracking',
  category: 'social',

  commands: [
    // Core (5)
    propose,
    adopt,
    divorce,
    disown,
    tree,
    // Info (3)
    partner,
    children,
    family,
    // Staff (1)
    familyConfig,
  ],

  events: familyEvents,

  async onLoad() {
    logger.info('Family module loaded with 9 commands');
  },

  defaultConfig: {
    enabled: true,
    maxChildren: 10,
    proposalExpiry: 86400,
    adoptionExpiry: 86400,
    allowSelfAdopt: false,
    embedColor: '#E91E63',
  },
};

export default familyModule;
