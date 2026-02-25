import {  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Colors, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { shopHelpers } from '../helpers';
import { getBalance, addCurrency } from '../../Currency/helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Shop');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Purchase an item from the shop')
    .addStringOption((option) =>
      option
        .setName('item')
        .setDescription('Item name or ID')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('quantity')
        .setDescription('How many to buy')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    ),
  module: 'shop',
  permissionPath: 'shop.buy',
  premiumFeature: 'shop.basic',

  async autocomplete(interaction: AutocompleteInteraction) {
    try {
      const guildId = interaction.guildId!;
      const focusedValue = interaction.options.getFocused().toString().toLowerCase();

      const items = await shopHelpers.getShopItems(guildId);
      const filtered = items
        .filter((item) => item.name.toLowerCase().includes(focusedValue) || item.id.toString().includes(focusedValue))
        .slice(0, 25)
        .map((item) => ({
          name: `${item.name} (${item.price} currency)`,
          value: item.id.toString(),
        }));

      await interaction.respond(filtered);
    } catch (error) {
      logger.error('[Shop] /buy autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const itemInput = interaction.options.getString('item', true);
      const quantity = interaction.options.getInteger('quantity') || 1;

      const member = await interaction.guild?.members.fetch(userId);
      if (!member) {
        return await interaction.editReply({
          content: '❌ Could not find member information.',
        });
      }

      const config = await shopHelpers.getShopConfig(guildId);

      if (!config.enabled) {
        return await interaction.editReply({
          content: '❌ The shop is currently disabled.',
        });
      }

      let item = await shopHelpers.getShopItem(guildId, parseInt(itemInput));

      if (!item) {
        item = await shopHelpers.getShopItemByName(guildId, itemInput);
      }

      if (!item) {
        return await interaction.editReply({
          content: '❌ Item not found.',
        });
      }

      const canBuyResult = await shopHelpers.canBuy(guildId, userId, member, item, quantity);

      if (!canBuyResult.allowed) {
        return await interaction.editReply({
          content: `❌ ${canBuyResult.reason}`,
        });
      }

      const purchaseResult = await shopHelpers.purchaseItem(guildId, userId, member, item, quantity);

      if (!purchaseResult.success) {
        return await interaction.editReply({
          content: `❌ ${purchaseResult.reason}`,
        });
      }

      const newBalance = await getBalance(guildId, userId);
      const totalCost = item.price * quantity;
      const tax = Math.floor((totalCost * config.taxPercent) / 100);
      const finalCost = totalCost + tax;

      const embed = new EmbedBuilder()
        .setTitle('✅ Purchase Successful')
        .setColor(Colors.Green)
        .addFields(
          { name: 'Item', value: item.name, inline: true },
          { name: 'Quantity', value: `${quantity}`, inline: true },
          { name: 'Price (each)', value: `${item.price} currency`, inline: true },
          { name: 'Subtotal', value: `${totalCost} currency`, inline: true }
        );

      if (tax > 0) {
        embed.addFields({ name: 'Tax', value: `${tax} currency`, inline: true });
      }

      embed.addFields(
        { name: 'Total Cost', value: `${finalCost} currency`, inline: true },
        { name: 'New Balance', value: `${newBalance} currency`, inline: false }
      );

      const guild = interaction.guild;
      if (guild && config.logChannelId) {
        await shopHelpers.logShopAction(guild, config, 'Purchase', userId, item.name, finalCost);
      }

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      logger.error('[Shop] /buy command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred during purchase.',
      });
    }
  },
};

export default command;
