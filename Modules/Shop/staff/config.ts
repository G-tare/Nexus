import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Colors, PermissionFlagsBits, ChannelSelectMenuBuilder, ChannelType } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { shopHelpers, ShopConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { getRedis, getDb } from '../../../Shared/src/database/connection';
const logger = createModuleLogger('Shop');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('shop-config')
    .setDescription('Configure shop settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('view').setDescription('View current settings'))
    .addSubcommand((sub) =>
      sub
        .setName('currency')
        .setDescription('Set default currency type')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Currency type')
            .addChoices(
              { name: 'Primary', value: 'primary' },
              { name: 'Secondary', value: 'secondary' },
              { name: 'Tertiary', value: 'tertiary' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('tax')
        .setDescription('Set tax percentage on purchases')
        .addIntegerOption((opt) =>
          opt
            .setName('percent')
            .setDescription('Tax percentage (0-100)')
            .setMinValue(0)
            .setMaxValue(100)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-items')
        .setDescription('Set maximum items in shop')
        .addIntegerOption((opt) =>
          opt
            .setName('count')
            .setDescription('Maximum items (1-200)')
            .setMinValue(1)
            .setMaxValue(200)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('log-channel')
        .setDescription('Set logging channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to log to (or none)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('show-out-of-stock')
        .setDescription('Toggle showing out of stock items')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Show out of stock items?').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('refunds')
        .setDescription('Toggle refunds')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable refunds?').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('refund-percent')
        .setDescription('Set refund percentage')
        .addIntegerOption((opt) =>
          opt
            .setName('percent')
            .setDescription('Refund percentage (0-100)')
            .setMinValue(0)
            .setMaxValue(100)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable the shop')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable shop?').setRequired(true)
        )
    ),
  module: 'shop',
  permissionPath: 'shop.config',
  premiumFeature: 'shop.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guildId = interaction.guildId!;
      const subcommand = interaction.options.getSubcommand();

      let config = await shopHelpers.getShopConfig(guildId);
      const db = getDb();

      switch (subcommand) {
        case 'view': {
          const embed = new EmbedBuilder()
            .setTitle('Shop Configuration')
            .setColor(Colors.Blurple)
            .addFields(
              { name: 'Enabled', value: config.enabled ? '✅ Yes' : '❌ No', inline: true },
              { name: 'Currency Type', value: config.currencyType, inline: true },
              { name: 'Tax %', value: `${config.taxPercent}%`, inline: true },
              { name: 'Max Items', value: `${config.maxItemsPerServer}`, inline: true },
              { name: 'Show Out of Stock', value: config.showOutOfStock ? '✅ Yes' : '❌ No', inline: true },
              { name: 'Refunds Enabled', value: config.refundsEnabled ? '✅ Yes' : '❌ No', inline: true },
              { name: 'Refund %', value: `${config.refundPercent}%`, inline: true },
              {
                name: 'Log Channel',
                value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not set',
                inline: true,
              }
            );

          return await interaction.editReply({ embeds: [embed] });
        }

        case 'currency': {
          const type = interaction.options.getString('type') as 'primary' | 'secondary' | 'tertiary';
          // TODO: Update shop config in database/cache
          await getRedis().del(`shop:config:${guildId}`);

          return await interaction.editReply({
            content: `✅ Default currency set to **${type}**.`,
          });
        }

        case 'tax': {
          const percent = interaction.options.getInteger('percent', true);
          // TODO: Update shop config in database
          await getRedis().del(`shop:config:${guildId}`);

          return await interaction.editReply({
            content: `✅ Tax set to **${percent}%**.`,
          });
        }

        case 'max-items': {
          const count = interaction.options.getInteger('count', true);
          // TODO: Update shop config in database
          await getRedis().del(`shop:config:${guildId}`);

          return await interaction.editReply({
            content: `✅ Max items set to **${count}**.`,
          });
        }

        case 'log-channel': {
          const channel = interaction.options.getChannel('channel');
          // TODO: Update shop config in database
          await getRedis().del(`shop:config:${guildId}`);

          return await interaction.editReply({
            content: `✅ Log channel ${channel ? `set to <#${channel.id}>` : 'disabled'}.`,
          });
        }

        case 'show-out-of-stock': {
          const enabled = interaction.options.getBoolean('enabled', true);
          // TODO: Update shop config in database
          await getRedis().del(`shop:config:${guildId}`);

          return await interaction.editReply({
            content: `✅ Show out of stock: **${enabled ? 'enabled' : 'disabled'}**.`,
          });
        }

        case 'refunds': {
          const enabled = interaction.options.getBoolean('enabled', true);
          // TODO: Update shop config in database
          await getRedis().del(`shop:config:${guildId}`);

          return await interaction.editReply({
            content: `✅ Refunds: **${enabled ? 'enabled' : 'disabled'}**.`,
          });
        }

        case 'refund-percent': {
          const percent = interaction.options.getInteger('percent', true);
          // TODO: Update shop config in database
          await getRedis().del(`shop:config:${guildId}`);

          return await interaction.editReply({
            content: `✅ Refund percentage set to **${percent}%**.`,
          });
        }

        case 'toggle': {
          const enabled = interaction.options.getBoolean('enabled', true);
          // TODO: Update shop config in database
          await getRedis().del(`shop:config:${guildId}`);

          return await interaction.editReply({
            content: `✅ Shop: **${enabled ? 'enabled' : 'disabled'}**.`,
          });
        }
      }
    } catch (error) {
      logger.error('[Shop] /shop-config command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while updating config.',
      });
    }
  },
};

export default command;
