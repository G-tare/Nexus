import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, successContainer, addText, addSeparator, addSectionWithThumbnail } from '../../../Shared/src/utils/componentsV2';
import { getCurrencyConfig, getBalance, removeCurrency, ensureMember, formatCurrency, CurrencyType } from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('currency-take')
    .setDescription('Remove currency from a user')
    .addUserOption((option) =>
      option.setName('user').setDescription('User to take currency from').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Amount of currency to take')
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
  permissionPath: 'currency.take',
  premiumFeature: 'currency.single',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const user = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);
      const type = interaction.options.getString('type', true) as CurrencyType;

      await interaction.deferReply();

      const config = await getCurrencyConfig(interaction.guildId!);
      await ensureMember(interaction.guildId!, user.id);

      // Get old balance
      const oldBalance = await getBalance(interaction.guildId!, user.id);
      const oldAmount = type === 'coins' ? oldBalance.coins : type === 'gems' ? oldBalance.gems : oldBalance.eventTokens;

      const result = await removeCurrency(interaction.guildId!, user.id, type, amount, 'admin_take');

      if (!result.success) {
        return interaction.editReply({
          components: [errorContainer('Insufficient Funds', `User has ${oldAmount} ${config.currencies[type].name}.`)],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const currencyInfo = config.currencies[type];
      const container = successContainer('Currency Removed');
      addText(container, `**User:** ${user.toString()}`);
      addText(container, `**Amount Removed:** ${formatCurrency(amount, currencyInfo)}`);
      addText(container, `**Old Balance:** ${formatCurrency(oldAmount, currencyInfo)}`);
      addText(container, `**New Balance:** ${formatCurrency(result.newBalance, currencyInfo)}`);
      addSeparator(container);
      addSectionWithThumbnail(container, `${user.username}`, user.displayAvatarURL({ size: 256 }));

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.error('Error in take command:', error);
      await interaction.editReply({
        components: [errorContainer('Error', 'An error occurred while removing currency.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
} as BotCommand;
