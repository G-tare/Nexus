import { BotModule } from '../../Shared/src/types/command';
import { colorRolesEvents } from './events';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands (user-facing)
import color from './core/color';
import colorrandom from './core/colorrandom';
import colorlist from './core/colorlist';
import colorinfo from './core/colorinfo';
import colorremove from './core/colorremove';
import colorsuggest from './core/colorsuggest';

// Staff commands — Adding
import coloradd from './staff/coloradd';
import coloraddrgb from './staff/coloraddrgb';
import coloraddrandom from './staff/coloraddrandom';
import coloradddefaults from './staff/coloradddefaults';
import coloraddexisting from './staff/coloraddexisting';

// Staff commands — Editing/Deleting
import coloredit from './staff/coloredit';
import colordelete from './staff/colordelete';
import colorclear from './staff/colorclear';

// Staff commands — Member management
import colorsetmember from './staff/colorsetmember';

// Staff commands — Reaction system
import colorreaction from './staff/colorreaction';
import colorreactionlist from './staff/colorreactionlist';
import colorreactiondelete from './staff/colorreactiondelete';
import colorreactionclear from './staff/colorreactionclear';

// Staff commands — Save/Export
import colorsave from './staff/colorsave';
import colorsaves from './staff/colorsaves';
import colorrestore from './staff/colorrestore';
import colorexport from './staff/colorexport';
import colorimport from './staff/colorimport';

// Staff commands — Configuration
import colorconfig from './staff/colorconfig';

const logger = createModuleLogger('ColorRoles');

const colorRolesModule: BotModule = {
  name: 'colorroles',
  displayName: 'Color Roles',
  description: 'Full-featured color role system with palette management, reaction roles, image generation, save/export, whitelist, auto-assign on join, and more.',
  category: 'engagement',

  commands: [
    // Core (6)
    color,
    colorrandom,
    colorlist,
    colorinfo,
    colorremove,
    colorsuggest,

    // Staff — Adding (5)
    coloradd,
    coloraddrgb,
    coloraddrandom,
    coloradddefaults,
    coloraddexisting,

    // Staff — Edit/Delete (3)
    coloredit,
    colordelete,
    colorclear,

    // Staff — Members (1)
    colorsetmember,

    // Staff — Reactions (4)
    colorreaction,
    colorreactionlist,
    colorreactiondelete,
    colorreactionclear,

    // Staff — Save/Export (5)
    colorsave,
    colorsaves,
    colorrestore,
    colorexport,
    colorimport,

    // Staff — Config (1)
    colorconfig,
  ],

  events: colorRolesEvents,

  async onLoad() {
    logger.info('ColorRoles module loaded — 25 commands across core and staff directories');
  },

  defaultConfig: {
    enabled: true,
    joinColor: null,
    reactionMessages: true,
    deleteResponses: false,
    deleteResponseDelay: 10,
    commandChannelId: null,
    managementRoleIds: [],
    whitelistEnabled: false,
    whitelistRoleIds: [],
    overlapWarning: true,
    overlapThreshold: 15,
    colorRoleAnchorId: null,
    colorRolePosition: 'below',
    maxColors: 50,
  },
};

export default colorRolesModule;
