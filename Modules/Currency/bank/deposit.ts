import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  successContainer,
  errorContainer,
  moduleContainer,
  addText,
  addFields,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { depositToBank, ensureBankAccount, getCurrencyConfig } from '../helpers';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.bank',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('bank-deposit')
    .setDescription('Deposit coins into your bank account')
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('Amount to deposit').setRequired(true).setMinValue(1)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const amount = interaction.options.getInteger('amount', true);

      await interaction.deferReply();

      const config = await getCurrencyConfig(guildId);
      await ensureBankAccount(guildId, userId);

      const result = await depositToBank(guildId, userId, amount);

      if (!result.success) {
        const container = errorContainer('Deposit Failed', result.error || 'Failed to deposit coins.');
        return interaction.editReply(v2Payload([container]));
      }

      const container = moduleContainer('currency');
      addText(container, '### 💰 Coins Deposited');
      addFields(container, [
        { name: 'Amount Deposited', value: `${amount.toLocaleString()}`, inline: true },
        { name: 'New Bank Balance', value: `${result.newBankBalance.toLocaleString()}`, inline: true }
      ]);
      addFooter(container, `Deposited at ${new Date().toLocaleString()}`);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Bank Deposit Error]', error);
      const container = errorContainer('Deposit Error', 'An error occurred while depositing coins.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
