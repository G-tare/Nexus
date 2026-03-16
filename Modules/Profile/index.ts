import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import view from './core/view';
import create from './core/create';
import deleteProfile from './core/delete';

// Edit commands
import aboutme from './edit/aboutme';
import age from './edit/age';
import gender from './edit/gender';
import location from './edit/location';
import status from './edit/status';
import birthday from './edit/birthday';
import color from './edit/color';
import banner from './edit/banner';

// List commands
import add from './lists/add';
import remove from './lists/remove';

// Staff commands
import profileConfig from './staff/config';

// Events
import { profileEvents } from './events';

const logger = createModuleLogger('Profile');

export const profileModule: BotModule = {
  name: 'profile',
  displayName: 'Profile',
  description: 'Customizable user profiles with social fields and list favorites',
  category: 'social',

  commands: [
    // Core (3)
    view,
    create,
    deleteProfile,
    // Edit (8)
    aboutme,
    age,
    gender,
    location,
    status,
    birthday,
    color,
    banner,
    // Lists (2)
    add,
    remove,
    // Staff (1)
    profileConfig,
  ],

  events: profileEvents,

  async onLoad() {
    logger.info('Profile module loaded with 14 commands');
  },

  defaultConfig: {
    enabled: true,
    maxListItems: 10,
    requireCreate: true,
    embedColor: '#9B59B6',
  },
};

export default profileModule;
