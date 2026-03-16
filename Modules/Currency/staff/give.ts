import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, successContainer, addText, addSeparator, addSectionWithThumbnail } from '../../../Shared/src/utils/componentsV2';
import { getCurrencyConfig, addCurrency, ensureMember, formatCurrency, CurrencyType } from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('currency-give')
    .setDescription('Give currency to a user')
    .addUserOption((option) =>
      option.setName('user').setDescription('User to give currency to').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Amount of currency to give')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000000)
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Type of currency')
        .setRequired(true)
        .addChoices(
          { name: 'Coins', value: 'coins' },
          { name: 'Gems', value: 'gems' },
          { name: 'Event Tokens', value: 'event_tokens' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ,

  module: 'currency',
  permissionPath: 'currency.give',
  premiumFeature: 'currency.single',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const user = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);
      const type = interaction.options.getString('type', true) as CurrencyType;

      await interaction.deferReply();

      const config = await getCurrencyConfig(interaction.guildId!);
      await ensureMember(interaction.guildId!, user.id);

      const result = await addCurrency(interaction.guildId!, user.id, type, amount, 'admin_give');

      if (!result) {
        return interaction.editReply({
          components: [errorContainer('Failed', 'Failed to give currency.')],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const currencyInfo = config.currencies[type];
      const container = successContainer('Currency Given');
      addText(container, `**User:** ${user.toString()}`);
      addText(container, `**Amount Given:** ${formatCurrency(amount, currencyInfo)}`);
      addText(container, `**New Balance:** ${formatCurrency(result, currencyInfo)}`);
      addSeparator(container);
      addSectionWithThumbnail(container, `${user.username}`, user.displayAvatarURL({ size: 256 }));

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.error('Error in give command:', error);
      await interaction.editReply({
        components: [errorContainer('Error', 'An error occurred while giving currency.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
} as BotCommand;
