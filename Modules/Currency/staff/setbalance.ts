import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getCurrencyConfig, getBalance, setCurrency, ensureMember, formatCurrency, CurrencyType } from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('currency-setbalance')
    .setDescription('Set exact currency balance for a user')
    .addUserOption((option) =>
      option.setName('user').setDescription('User to set balance for').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('New balance amount')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(10000000)
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
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    ,

  module: 'currency',
  permissionPath: 'currency.setbalance',
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

      const result = await setCurrency(interaction.guildId!, user.id, type, amount, 'admin_set');

      if (!(result as any).success) {
        return interaction.editReply({
          embeds: [errorEmbed(`Failed to set balance: ${(result as any).error}`)],
        });
      }

      const currencyInfo = config.currencies[type];
      const embed = successEmbed(`Balance Set`)
        .addFields(
          { name: 'User', value: user.toString(), inline: true },
          { name: 'Old Balance', value: formatCurrency(oldAmount, currencyInfo), inline: true },
          { name: 'New Balance', value: formatCurrency(amount, currencyInfo), inline: true }
        )
        .setThumbnail(user.avatarURL());

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in setbalance command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while setting balance.')],
      });
    }
  },
} as BotCommand;
