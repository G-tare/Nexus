import { AutocompleteInteraction } from 'discord.js';
import { createModuleLogger } from '../../Shared/src/utils/logger';
const logger = createModuleLogger('Shop');
import { shopHelpers } from './helpers';

/**
 * Handle shop autocomplete interactions
 */
export async function handleShopAutocomplete(interaction: AutocompleteInteraction) {
  try {
    const guildId = interaction.guildId!;
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'item') {
      const commandName = interaction.commandName;

      if (commandName === 'buy' || commandName === 'shop-remove' || commandName === 'shop-edit' || commandName === 'shop-add') {
        const items = await shopHelpers.getShopItems(guildId);
        const input = focusedOption.value.toString().toLowerCase();

        const filtered = items
          .filter((item) => item.name.toLowerCase().includes(input) || item.id.toString().includes(input))
          .slice(0, 25)
          .map((item) => ({
            name: `${item.name} (${item.price} currency)`,
            value: item.id.toString(),
          }));

        return await interaction.respond(filtered);
      }

      if (commandName === 'use') {
        const userId = interaction.user.id;
        const inventory = await shopHelpers.getUserInventory(guildId, userId);
        const input = focusedOption.value.toString().toLowerCase();

        const filtered = inventory
          .filter((item) => item.itemName.toLowerCase().includes(input) || item.itemId.toString().includes(input))
          .slice(0, 25)
          .map((item) => ({
            name: `${item.itemName} (${item.itemType}) x${item.quantity}`,
            value: item.itemId.toString(),
          }));

        return await interaction.respond(filtered);
      }
    }

    await interaction.respond([]);
  } catch (error) {
    logger.error('[Shop] Autocomplete error:', error);
    try {
      await interaction.respond([]);
    } catch (e) {
      // Already responded
    }
  }
}
