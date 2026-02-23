import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
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

      if (!(result as any).success) {
        return interaction.editReply({
          embeds: [errorEmbed(`Failed to give currency: ${(result as any).error}`)],
        });
      }

      const currencyInfo = config.currencies[type];
      const embed = successEmbed(`Currency Given`)
        .addFields(
          { name: 'User', value: user.toString(), inline: true },
          { name: 'Amount Given', value: formatCurrency(amount, currencyInfo), inline: true },
          { name: 'New Balance', value: formatCurrency((result as any).newBalance, currencyInfo), inline: true }
        )
        .setThumbnail(user.avatarURL());

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in give command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while giving currency.')],
      });
    }
  },
} as BotCommand;
