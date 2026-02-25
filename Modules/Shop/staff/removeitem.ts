import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Colors,
  PermissionFlagsBits,
  AutocompleteInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { shopHelpers } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Shop');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('shop-remove')
    .setDescription('Remove an item from the shop')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt
        .setName('item')
        .setDescription('Item name or ID')
        .setAutocomplete(true)
        .setRequired(true)
    ),
  module: 'shop',
  permissionPath: 'shop.removeitem',
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
      logger.error('[Shop] /shop-remove autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
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

      const confirmEmbed = new EmbedBuilder()
        .setTitle('Confirm Item Deletion')
        .setColor(Colors.Red)
        .setDescription(`Are you sure you want to remove **${item.name}** from the shop?`)
        .addFields({ name: 'Item ID', value: item.id.toString(), inline: false });

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`shop:remove_confirm:${item.id}`)
          .setLabel('Confirm Delete')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`shop:remove_cancel:${item.id}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [confirmEmbed],
        components: [buttons],
      });
    } catch (error) {
      logger.error('[Shop] /shop-remove command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while removing the item.',
      });
    }
  },
};

export default command;
