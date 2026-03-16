import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, successContainer, addText, addSeparator, addSectionWithThumbnail } from '../../../Shared/src/utils/componentsV2';
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

      if (!result) {
        return interaction.editReply({
          components: [errorContainer('Failed', 'Failed to set balance.')],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const currencyInfo = config.currencies[type];
      const container = successContainer('Balance Set');
      addText(container, `**User:** ${user.toString()}`);
      addText(container, `**Old Balance:** ${formatCurrency(oldAmount, currencyInfo)}`);
      addText(container, `**New Balance:** ${formatCurrency(amount, currencyInfo)}`);
      addSeparator(container);
      addSectionWithThumbnail(container, `${user.username}`, user.displayAvatarURL({ size: 256 }));

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.error('Error in setbalance command:', error);
      await interaction.editReply({
        components: [errorContainer('Error', 'An error occurred while setting balance.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
} as BotCommand;
