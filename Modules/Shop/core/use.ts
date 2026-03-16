import {  SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { shopHelpers } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addFields, v2Payload, successContainer, errorContainer } from '../../../Shared/src/utils/componentsV2';
const logger = createModuleLogger('Shop');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an item from your inventory')
    .addStringOption((option) =>
      option
        .setName('item')
        .setDescription('Item to use')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('target')
        .setDescription('Target giveaway ID (for giveaway entries)')
        .setRequired(false)
    ),
  module: 'shop',
  permissionPath: 'shop.use',
  premiumFeature: 'shop.basic',

  async autocomplete(interaction: AutocompleteInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const focusedValue = interaction.options.getFocused().toString().toLowerCase();

      const inventory = await shopHelpers.getUserInventory(guildId, userId);
      const filtered = inventory
        .filter((item) => item.itemName.toLowerCase().includes(focusedValue) || item.itemId.toString().includes(focusedValue))
        .slice(0, 25)
        .map((item) => ({
          name: `${item.itemName} (${item.itemType}) x${item.quantity}`,
          value: item.itemId.toString(),
        }));

      await interaction.respond(filtered);
    } catch (error) {
      logger.error('[Shop] /use autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const itemInput = interaction.options.getString('item', true);
      const targetGiveaway = interaction.options.getString('target');

      const member = await interaction.guild?.members.fetch(userId);
      if (!member) {
        return await interaction.editReply({
          content: '❌ Could not find member information.',
        });
      }

      const inventory = await shopHelpers.getUserInventory(guildId, userId);
      let invItem = inventory.find((i) => i.itemName.toLowerCase() === itemInput.toLowerCase());

      if (!invItem) {
        const itemIdNum = parseInt(itemInput);
        if (!isNaN(itemIdNum)) {
          invItem = inventory.find((i) => i.itemId === itemIdNum);
        }
      }

      if (!invItem) {
        return await interaction.editReply({
          content: '❌ You do not own this item.',
        });
      }

      const item = await shopHelpers.getShopItem(guildId, invItem.itemId);
      if (!item) {
        return await interaction.editReply({
          content: '❌ Item not found.',
        });
      }

      // Special handling for giveaway entries
      if (item.itemType === 'giveaway_entry') {
        if (!targetGiveaway) {
          return await interaction.editReply(v2Payload([errorContainer('Error', 'You must provide a giveaway ID to use a giveaway entry.')]));
        }

        const alreadyUsed = await shopHelpers.checkGiveawayEntryLimit(
          guildId,
          userId,
          targetGiveaway
        );

        if (alreadyUsed) {
          return await interaction.editReply(v2Payload([errorContainer('Error', 'You have already used a bonus entry on this giveaway. You can only use one per giveaway.')]));
        }

        await shopHelpers.addGiveawayEntry(guildId, userId, targetGiveaway);
        await shopHelpers.removeFromInventory(guildId, userId, invItem.itemId, 1);

        const container = successContainer('Bonus Entry Applied');
        addFields(container, [
          { name: 'Item', value: item.name, inline: true },
          { name: 'Giveaway', value: targetGiveaway, inline: true }
        ]);

        return await interaction.editReply(v2Payload([container]));
      }

      const useResult = await shopHelpers.useItem(guildId, userId, member, invItem.itemId);

      if (!useResult.success) {
        return await interaction.editReply(v2Payload([errorContainer('Error', useResult.reason)]));
      }

      const container = successContainer('Item Used');
      const fields = [{ name: 'Item', value: item.name, inline: true }];

      if (item.itemType === 'xp_boost') {
        fields.push({
          name: 'Duration',
          value: item.itemData.duration || 'Unknown',
          inline: true,
        });
        fields.push({
          name: 'Multiplier',
          value: `${item.itemData.multiplier}x`,
          inline: true,
        });
      }

      addFields(container, fields);
      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error('[Shop] /use command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while using the item.',
      });
    }
  },
};

export default command;
