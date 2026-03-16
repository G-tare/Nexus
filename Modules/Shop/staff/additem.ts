import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { shopHelpers, ShopItemType } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addFields, v2Payload, successContainer, errorContainer } from '../../../Shared/src/utils/componentsV2';
const logger = createModuleLogger('Shop');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('shop-add')
    .setDescription('Add an item to the shop')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Item name (max 50 chars)')
        .setMaxLength(50)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('description')
        .setDescription('Item description (max 200 chars)')
        .setMaxLength(200)
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('price')
        .setDescription('Price in currency')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Item type')
        .addChoices(
          { name: 'Role', value: 'role' },
          { name: 'Custom Role', value: 'custom_role' },
          { name: 'XP Boost', value: 'xp_boost' },
          { name: 'Counting Life', value: 'counting_life' },
          { name: 'Giveaway Entry', value: 'giveaway_entry' },
          { name: 'Badge', value: 'badge' },
          { name: 'Consumable', value: 'consumable' },
          { name: 'Custom', value: 'custom' }
        )
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('stock')
        .setDescription('Stock (0 = unlimited)')
        .setMinValue(0)
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('max-per-user')
        .setDescription('Max per user (0 = unlimited)')
        .setMinValue(0)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('emoji').setDescription('Emoji for display').setRequired(false)
    )
    .addRoleOption((opt) =>
      opt.setName('role').setDescription('Role to grant (for role type)')
    )
    .addStringOption((opt) =>
      opt.setName('duration').setDescription('Duration (e.g., 1h, 30m, for xp_boost)')
    )
    .addNumberOption((opt) =>
      opt
        .setName('multiplier')
        .setDescription('XP multiplier (e.g., 2.0 for 2x)')
        .setMinValue(1)
    )
    .addRoleOption((opt) =>
      opt.setName('require-role').setDescription('Role required to purchase')
    )
    .addIntegerOption((opt) =>
      opt
        .setName('require-level')
        .setDescription('Minimum level to purchase')
        .setMinValue(1)
    ),
  module: 'shop',
  permissionPath: 'shop.additem',
  premiumFeature: 'shop.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const name = interaction.options.getString('name', true);
      const description = interaction.options.getString('description', true);
      const price = interaction.options.getInteger('price', true);
      const type = interaction.options.getString('type', true) as ShopItemType;
      const stock = interaction.options.getInteger('stock') || 0;
      const maxPerUser = interaction.options.getInteger('max-per-user') || 0;
      const emoji = interaction.options.getString('emoji');
      const requireRole = interaction.options.getRole('require-role');
      const requireLevel = interaction.options.getInteger('require-level');

      const itemData: Record<string, any> = {};

      // Build data based on type
      switch (type) {
        case 'role': {
          const role = interaction.options.getRole('role');
          if (!role) {
            return await interaction.editReply({
              content: '❌ Role type requires a role to be specified.',
            });
          }
          itemData.roleId = role.id;
          break;
        }

        case 'custom_role': {
          itemData.color = '#FFFFFF';
          itemData.roleName = `Custom Role - ${name}`;
          break;
        }

        case 'xp_boost': {
          const duration = interaction.options.getString('duration');
          const multiplier = interaction.options.getNumber('multiplier');

          if (!duration || !multiplier) {
            return await interaction.editReply({
              content: '❌ XP Boost type requires duration and multiplier.',
            });
          }

          itemData.duration = duration;
          itemData.multiplier = multiplier;
          break;
        }

        case 'counting_life': {
          itemData.lives = 1;
          break;
        }

        case 'giveaway_entry': {
          itemData.entries = 1;
          break;
        }

        case 'badge': {
          itemData.badgeId = name.toLowerCase().replace(/\s/g, '_');
          break;
        }

        case 'consumable':
        case 'custom': {
          // No special data required
          break;
        }
      }

      // Create item
      const newItem = await shopHelpers.addShopItem(guildId, {
        name,
        description,
        price,
        currencyType: (await shopHelpers.getShopConfig(guildId)).currencyType,
        itemType: type,
        itemData: itemData,
        stock: stock || null,
        requiredRoleId: requireRole?.id,
        requiredLevel: requireLevel || undefined,
      });

      if (!newItem) {
        return await interaction.editReply({
          content: '❌ Failed to create item. You may have reached the maximum items limit.',
        });
      }

      const container = successContainer('Item Added');
      addFields(container, [
        { name: 'Name', value: newItem.name, inline: true },
        { name: 'Type', value: newItem.itemType, inline: true },
        { name: 'Price', value: newItem.price.toString(), inline: true },
        { name: 'Stock', value: newItem.stock === null ? 'Unlimited' : newItem.stock.toString(), inline: true },
        { name: 'ID', value: newItem.id.toString(), inline: true }
      ]);

      const guild = interaction.guild;
      if (guild) {
        const config = await shopHelpers.getShopConfig(guildId);
        await shopHelpers.logShopAction(guild, config, 'Item Added', interaction.user.id, name, price);
      }

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error('[Shop] /shop-add command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while adding the item.',
      });
    }
  },
};

export default command;
