import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  moduleContainer,
  addText,
  addFields,
  addSectionWithThumbnail,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { getBankBalance, getBalance, ensureBankAccount } from '../helpers';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.bank',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('bank-balance')
    .setDescription('Check your bank and savings balance'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      await interaction.deferReply();

      await ensureBankAccount(guildId, userId);
      const walletBalance = await getBalance(guildId, userId);
      const bankData = await getBankBalance(guildId, userId);

      let padlockStatus = '🔓 Not Protected';
      if (bankData.padlockActive && bankData.padlockExpires) {
        const now = new Date();
        if (bankData.padlockExpires > now) {
          const diffMs = bankData.padlockExpires.getTime() - now.getTime();
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          padlockStatus = `🔒 Protected (${days}d ${hours}h)`;
        } else {
          padlockStatus = '🔓 Expired';
        }
      }

      const container = moduleContainer('currency');
      addSectionWithThumbnail(
        container,
        '### 🏦 Bank Account',
        interaction.user.displayAvatarURL()
      );
      addFields(container, [
        { name: '👛 Wallet Balance', value: walletBalance.coins.toLocaleString(), inline: true },
        { name: '🏦 Bank Balance', value: bankData.bankBalance.toLocaleString(), inline: true },
        { name: '💰 Savings Balance', value: bankData.savingsBalance.toLocaleString(), inline: true },
        { name: '📊 Total Net Worth', value: bankData.totalNetWorth.toLocaleString(), inline: false },
        { name: '📈 Daily Deposit Limit', value: `${bankData.depositLimitRemaining.toLocaleString()} remaining`, inline: true },
        { name: '🔐 Robbery Protection', value: padlockStatus, inline: true }
      ]);
      addFooter(container, `Requested by ${interaction.user.username}`);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Bank Balance Error]', error);
      const container = moduleContainer('currency');
      addText(container, '### ❌ Error');
      addText(container, 'An error occurred while fetching your bank balance.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
