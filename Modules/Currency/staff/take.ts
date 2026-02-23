import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
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
          embeds: [errorEmbed(`Insufficient funds. User has ${oldAmount} ${config.currencies[type].name}.`)],
        });
      }

      const currencyInfo = config.currencies[type];
      const embed = successEmbed(`Currency Removed`)
        .addFields(
          { name: 'User', value: user.toString(), inline: true },
          { name: 'Amount Removed', value: formatCurrency(amount, currencyInfo), inline: true },
          { name: 'Old Balance', value: formatCurrency(oldAmount, currencyInfo), inline: true },
          { name: 'New Balance', value: formatCurrency(result.newBalance, currencyInfo), inline: true }
        )
        .setThumbnail(user.avatarURL());

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in take command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while removing currency.')],
      });
    }
  },
} as BotCommand;
