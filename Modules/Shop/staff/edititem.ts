import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Colors,
  PermissionFlagsBits,
  AutocompleteInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { shopHelpers } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Shop');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('shop-edit')
    .setDescription('Edit shop item properties')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('price')
        .setDescription('Edit item price')
        .addStringOption((opt) =>
          opt
            .setName('item')
            .setDescription('Item name or ID')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('price')
            .setDescription('New price')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('stock')
        .setDescription('Edit item stock')
        .addStringOption((opt) =>
          opt
            .setName('item')
            .setDescription('Item name or ID')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('stock')
            .setDescription('New stock (0 = unlimited)')
            .setMinValue(0)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('description')
        .setDescription('Edit item description')
        .addStringOption((opt) =>
          opt
            .setName('item')
            .setDescription('Item name or ID')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('description')
            .setDescription('New description (max 200 chars)')
            .setMaxLength(200)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable item')
        .addStringOption((opt) =>
          opt
            .setName('item')
            .setDescription('Item name or ID')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable item?').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-per-user')
        .setDescription('Edit max per user')
        .addStringOption((opt) =>
          opt
            .setName('item')
            .setDescription('Item name or ID')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('max')
            .setDescription('New max (0 = unlimited)')
            .setMinValue(0)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('requirement')
        .setDescription('Edit item requirements')
        .addStringOption((opt) =>
          opt
            .setName('item')
            .setDescription('Item name or ID')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Required role (or none)')
        )
        .addIntegerOption((opt) =>
          opt
            .setName('level')
            .setDescription('Required level (or none)')
            .setMinValue(1)
        )
    ),
  module: 'shop',
  permissionPath: 'shop.edititem',
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
          name: item.name,
          value: item.id.toString(),
        }));

      await interaction.respond(filtered);
    } catch (error) {
      logger.error('[Shop] /shop-edit autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guildId = interaction.guildId!;
      const subcommand = interaction.options.getSubcommand();
      const itemInput = interaction.options.getString('item', true);

      let item = await shopHelpers.getShopItem(guildId, parseInt(itemInput));

      if (!item) {
        item = await shopHelpers.getShopItemByName(guildId, itemInput);
      }

      if (!item) {
        return await interaction.editReply({
          content: '❌ Item not found.',
        });
      }

      const updates: any = {};

      switch (subcommand) {
        case 'price': {
          const price = interaction.options.getInteger('price', true);
          updates.price = price;
          break;
        }

        case 'stock': {
          const stock = interaction.options.getInteger('stock', true);
          updates.stock = stock;
          break;
        }

        case 'description': {
          const description = interaction.options.getString('description', true);
          updates.description = description;
          break;
        }

        case 'toggle': {
          const enabled = interaction.options.getBoolean('enabled', true);
          updates.isActive = enabled;
          break;
        }

        case 'max-per-user': {
          // Max per user is no longer a direct property
          break;
        }

        case 'requirement': {
          const role = interaction.options.getRole('role');
          const level = interaction.options.getInteger('level');

          updates.requireRoleId = role?.id || undefined;
          updates.requireLevel = level || undefined;
          break;
        }
      }

      const updatedItem = await shopHelpers.editShopItem(guildId, item.id, updates);

      if (!updatedItem) {
        return await interaction.editReply({
          content: '❌ Failed to update item.',
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Item Updated')
        .setColor(Colors.Green)
        .addFields(
          { name: 'Item', value: updatedItem.name, inline: true },
          { name: 'Price', value: updatedItem.price.toString(), inline: true },
          { name: 'Stock', value: updatedItem.stock === null ? 'Unlimited' : updatedItem.stock.toString(), inline: true },
          {
            name: 'Description',
            value: updatedItem.description || 'No description',
            inline: false,
          }
        );

      const guild = interaction.guild;
      if (guild) {
        const config = await shopHelpers.getShopConfig(guildId);
        await shopHelpers.logShopAction(
          guild,
          config,
          `Item Edited (${subcommand})`,
          interaction.user.id,
          item.name
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('[Shop] /shop-edit command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while editing the item.',
      });
    }
  },
};

export default command;
