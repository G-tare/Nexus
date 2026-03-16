import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createModuleLogger } from '../../Shared/src/utils/logger';
const logger = createModuleLogger('Shop');
import { shopHelpers } from './helpers';
import { errorContainer, v2Payload } from '../../Shared/src/utils/componentsV2';

/**
 * Handle shop button interactions
 * Buttons format: shop:action:data
 * Examples:
 *   - shop:prev:1 (previous page)
 *   - shop:next:1 (next page)
 *   - shop:remove_confirm:item_id
 *   - shop:remove_cancel:item_id
 */
export async function handleShopButton(interaction: ButtonInteraction, action: string, data: string) {
  try {
    const guildId = interaction.guildId!;

    switch (action) {
      case 'prev': {
        const currentPage = parseInt(data) || 1;
        const newPage = Math.max(1, currentPage - 1);

        const config = await shopHelpers.getShopConfig(guildId);
        let items = await shopHelpers.getShopItems(guildId);

        const embed = shopHelpers.buildShopEmbed(items, newPage, config);

        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`shop:prev:${newPage}`)
            .setLabel('← Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(newPage <= 1),
          new ButtonBuilder()
            .setCustomId(`shop:next:${newPage}`)
            .setLabel('Next →')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(false)
        );

        await interaction.update({
          ...v2Payload([embed]),
          components: [buttons],
        });
        break;
      }

      case 'next': {
        const currentPage = parseInt(data) || 1;
        const newPage = currentPage + 1;

        const config = await shopHelpers.getShopConfig(guildId);
        let items = await shopHelpers.getShopItems(guildId);

        const itemsPerPage = 10;
        const totalPages = Math.ceil(items.length / itemsPerPage);

        if (newPage > totalPages) {
          await interaction.deferUpdate();
          return;
        }

        const embed = shopHelpers.buildShopEmbed(items, newPage, config);

        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`shop:prev:${newPage}`)
            .setLabel('← Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(newPage <= 1),
          new ButtonBuilder()
            .setCustomId(`shop:next:${newPage}`)
            .setLabel('Next →')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(newPage >= totalPages)
        );

        await interaction.update({
          ...v2Payload([embed]),
          components: [buttons],
        });
        break;
      }

      case 'inv_prev': {
        const currentPage = parseInt(data) || 1;
        const newPage = Math.max(1, currentPage - 1);

        const userId = interaction.user.id;
        const inventory = await shopHelpers.getUserInventory(guildId, userId);

        const embed = shopHelpers.buildInventoryEmbed(inventory, newPage);

        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`shop:inv_prev:${newPage}`)
            .setLabel('← Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(newPage <= 1),
          new ButtonBuilder()
            .setCustomId(`shop:inv_next:${newPage}`)
            .setLabel('Next →')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(false)
        );

        await interaction.update({
          ...v2Payload([embed]),
          components: [buttons],
        });
        break;
      }

      case 'inv_next': {
        const currentPage = parseInt(data) || 1;
        const newPage = currentPage + 1;

        const userId = interaction.user.id;
        const inventory = await shopHelpers.getUserInventory(guildId, userId);

        const itemsPerPage = 15;
        const totalPages = Math.ceil(inventory.length / itemsPerPage);

        if (newPage > totalPages) {
          await interaction.deferUpdate();
          return;
        }

        const embed = shopHelpers.buildInventoryEmbed(inventory, newPage);

        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`shop:inv_prev:${newPage}`)
            .setLabel('← Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(newPage <= 1),
          new ButtonBuilder()
            .setCustomId(`shop:inv_next:${newPage}`)
            .setLabel('Next →')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(newPage >= totalPages)
        );

        await interaction.update({
          ...v2Payload([embed]),
          components: [buttons],
        });
        break;
      }

      case 'remove_confirm': {
        const itemId = parseInt(data);

        const removed = await shopHelpers.removeShopItem(guildId, itemId);

        if (!removed) {
          const errorContainerMsg = errorContainer('Item not found or already deleted.');
          return await interaction.update(v2Payload([errorContainerMsg]));
        }

        const { successContainer } = require('../../Shared/src/utils/componentsV2');
        const container = successContainer('Item Removed', 'The item has been removed from the shop.');

        await interaction.update(v2Payload([container]));

        const guild = interaction.guild;
        if (guild) {
          const config = await shopHelpers.getShopConfig(guildId);
          const item = await shopHelpers.getShopItem(guildId, itemId);
          await shopHelpers.logShopAction(
            guild,
            config,
            'Item Removed',
            interaction.user.id,
            item?.name || itemId.toString()
          );
        }
        break;
      }

      case 'remove_cancel': {
        await interaction.update({
          content: '❌ Deletion cancelled.',
          embeds: [],
          components: [],
        });
        break;
      }

      default: {
        logger.warn(`[Shop] Unknown button action: ${action}`);
        await interaction.deferUpdate();
        break;
      }
    }
  } catch (error) {
    logger.error('[Shop] Button handler error:', error);
    try {
      await interaction.deferUpdate();
    } catch (e) {
      // Already replied
    }
  }
}
