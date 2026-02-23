import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { shopHelpers, ShopItemType } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Shop');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse items available in the shop')
    .addIntegerOption((option) =>
      option.setName('page').setDescription('Page number').setMinValue(1).setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('category')
        .setDescription('Filter by category')
        .setChoices(
          { name: 'Roles', value: 'role' },
          { name: 'Custom Roles', value: 'custom_role' },
          { name: 'XP Boosts', value: 'xp_boost' },
          { name: 'Counting Lives', value: 'counting_life' },
          { name: 'Giveaway Entries', value: 'giveaway_entry' },
          { name: 'Badges', value: 'badge' },
          { name: 'Consumables', value: 'consumable' },
          { name: 'Custom', value: 'custom' }
        )
        .setRequired(false)
    ),
  module: 'shop',
  permissionPath: 'shop.browse',
  premiumFeature: 'shop.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const guildId = interaction.guildId!;
      const page = interaction.options.getInteger('page') || 1;
      const category = interaction.options.getString('category') as ShopItemType | null;

      const config = await shopHelpers.getShopConfig(guildId);

      if (!config.enabled) {
        return await interaction.editReply({
          content: '❌ The shop is currently disabled.',
        });
      }

      let items = await shopHelpers.getShopItems(guildId);

      if (category) {
        items = items.filter((item) => item.itemType === category);
      }

      if (!items.length && !config.showOutOfStock) {
        return await interaction.editReply({
          content: '❌ No items available in the shop.',
        });
      }

      const embed = shopHelpers.buildShopEmbed(items, page, config);

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`shop_prev_${page}`)
          .setLabel('← Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page <= 1),
        new ButtonBuilder()
          .setCustomId(`shop_next_${page}`)
          .setLabel('Next →')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(false) // Disable check would happen on click
      );

      await interaction.editReply({
        embeds: [embed],
        components: [buttons],
      });
    } catch (error) {
      logger.error('[Shop] /shop command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while loading the shop.',
      });
    }
  },
};

export default command;
