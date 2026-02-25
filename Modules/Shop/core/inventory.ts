import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { shopHelpers } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Shop');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View items in your inventory')
    .addIntegerOption((option) =>
      option.setName('page').setDescription('Page number').setMinValue(1).setRequired(false)
    ),
  module: 'shop',
  permissionPath: 'shop.inventory',
  premiumFeature: 'shop.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const page = interaction.options.getInteger('page') || 1;

      const inventory = await shopHelpers.getUserInventory(guildId, userId);

      const embed = shopHelpers.buildInventoryEmbed(inventory, page);

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`inv_prev_${page}`)
          .setLabel('← Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page <= 1),
        new ButtonBuilder()
          .setCustomId(`inv_next_${page}`)
          .setLabel('Next →')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(false)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [buttons],
      });
    } catch (error) {
      logger.error('[Shop] /inventory command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while loading your inventory.',
      });
    }
  },
};

export default command;
