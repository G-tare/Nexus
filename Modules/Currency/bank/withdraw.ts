import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  errorContainer,
  moduleContainer,
  addText,
  addFields,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { withdrawFromBank, ensureBankAccount, getBalance } from '../helpers';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.bank',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('bank-withdraw')
    .setDescription('Withdraw coins from your bank account')
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('Amount to withdraw').setRequired(true).setMinValue(1)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const amount = interaction.options.getInteger('amount', true);

      await interaction.deferReply();

      await ensureBankAccount(guildId, userId);
      const result = await withdrawFromBank(guildId, userId, amount);

      if (!result.success) {
        const container = errorContainer('Withdrawal Failed', result.error || 'Failed to withdraw coins.');
        return interaction.editReply(v2Payload([container]));
      }

      const newWalletBalance = await getBalance(guildId, userId);

      const container = moduleContainer('currency');
      addText(container, '### 💸 Coins Withdrawn');
      addFields(container, [
        { name: 'Amount Withdrawn', value: `${amount.toLocaleString()}`, inline: true },
        { name: 'New Bank Balance', value: `${result.newBankBalance.toLocaleString()}`, inline: true },
        { name: 'Wallet Balance', value: `${newWalletBalance.coins.toLocaleString()}`, inline: true }
      ]);
      addFooter(container, `Withdrawn at ${new Date().toLocaleString()}`);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Bank Withdraw Error]', error);
      const container = errorContainer('Withdrawal Error', 'An error occurred while withdrawing coins.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
