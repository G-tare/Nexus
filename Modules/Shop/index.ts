import { Client, AutocompleteInteraction, ButtonInteraction } from 'discord.js';
import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import shopCommand from './core/shop';
import buyCommand from './core/buy';
import inventoryCommand from './core/inventory';
import useCommand from './core/use';

// Staff commands
import configCommand from './staff/config';
import additemCommand from './staff/additem';
import removeitemCommand from './staff/removeitem';
import edititemCommand from './staff/edititem';

// Events & Handlers
import { shopEvents } from './events';
import { handleShopButton } from './buttons';
import { handleShopAutocomplete } from './autocomplete';

const logger = createModuleLogger('Shop');

const shopModule: BotModule = {
  name: 'shop',
  displayName: 'Shop',
  category: 'economy',
  description: 'Shop module for managing in-game items and purchases',
  version: '1.0.0',
  enabled: true,

  commands: [
    shopCommand,
    buyCommand,
    inventoryCommand,
    useCommand,
    configCommand,
    additemCommand,
    removeitemCommand,
    edititemCommand,
  ],

  defaultConfig: {
    enabled: true,
    currencyType: 'primary',
    taxPercent: 0,
    maxItemsPerServer: 50,
    showOutOfStock: false,
    refundsEnabled: true,
    refundPercent: 80,
  },

  events: shopEvents,

  async onLoad() {
    logger.info('Shop module loaded — 8 commands');
  },
};

export default shopModule;
