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
import { getDb } from '../../../Shared/src/database/connection';
import { sql } from 'drizzle-orm';
import { removeCurrency, ensureBankAccount, getBankBalance } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Currency');

const SAVINGS_TIERS = {
  '1d': { durationMs: 86400000, interestRate: 0.005 },
  '3d': { durationMs: 259200000, interestRate: 0.02 },
  '7d': { durationMs: 604800000, interestRate: 0.05 },
  '14d': { durationMs: 1209600000, interestRate: 0.12 },
  '30d': { durationMs: 2592000000, interestRate: 0.3 },
};

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.bank',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('bank-savings')
    .setDescription('Manage your savings account')
    .addSubcommand((sub) =>
      sub
        .setName('deposit')
        .setDescription('Lock coins in savings for interest')
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('Amount to deposit').setRequired(true).setMinValue(1)
        )
        .addStringOption((opt) =>
          opt
            .setName('duration')
            .setDescription('Lock duration')
            .setRequired(true)
            .addChoices(
              { name: '1 Day (0.5%)', value: '1d' },
              { name: '3 Days (2%)', value: '3d' },
              { name: '7 Days (5%)', value: '7d' },
              { name: '14 Days (12%)', value: '14d' },
              { name: '30 Days (30%)', value: '30d' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('check')
        .setDescription('Check your savings account status')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      await interaction.deferReply();
      await ensureBankAccount(guildId, userId);

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'deposit') {
        const amount = interaction.options.getInteger('amount', true);
        const duration = interaction.options.getString('duration', true) as keyof typeof SAVINGS_TIERS;

        // Check if amount is valid
        const result = await removeCurrency(guildId, userId, 'coins', amount, 'savings_deposit');
        if (!result.success) {
          const container = errorContainer('Deposit Failed', result.error ? result.error : 'Insufficient coins.');
          return interaction.editReply(v2Payload([container]));
        }

        const db = getDb();
        const tierInfo = SAVINGS_TIERS[duration];
        const now = new Date();
        const unlocksAt = new Date(now.getTime() + tierInfo.durationMs);
        const interestAmount = Math.floor(amount * tierInfo.interestRate);
        const totalWithInterest = amount + interestAmount;

        await db.execute(sql`
          UPDATE banks
          SET savings_balance = savings_balance + ${amount},
              savings_locked_until = ${unlocksAt.toISOString()},
              savings_interest_rate = ${tierInfo.interestRate},
              savings_deposited_at = ${now.toISOString()},
              last_interest_paid = ${now.toISOString()}
          WHERE guild_id = ${guildId} AND user_id = ${userId}
        `);

        const container = moduleContainer('currency');
        addText(container, '### 💳 Savings Deposited');
        addFields(container, [
          { name: 'Amount Locked', value: amount.toLocaleString(), inline: true },
          { name: 'Lock Duration', value: duration, inline: true },
          { name: 'Interest Rate', value: `${(tierInfo.interestRate * 100).toFixed(1)}%`, inline: true },
          { name: 'Expected Interest', value: interestAmount.toLocaleString(), inline: true },
          { name: 'Total with Interest', value: totalWithInterest.toLocaleString(), inline: true },
          { name: 'Unlocks At', value: `<t:${Math.floor(unlocksAt.getTime() / 1000)}:F>`, inline: false }
        ]);
        addFooter(container, `Locked at ${new Date().toLocaleString()}`);

        return interaction.editReply(v2Payload([container]));
      }

      if (subcommand === 'check') {
        const db = getDb();
        const savingsData = await db.execute(sql`
          SELECT
            savings_balance,
            savings_locked_until,
            savings_interest_rate,
            savings_deposited_at,
            last_interest_paid
          FROM banks
          WHERE guild_id = ${guildId} AND user_id = ${userId}
          LIMIT 1
        ` as any);

        const savings = savingsData?.rows[0];
        const now = new Date();

        if (!savings || Number(savings.savings_balance ?? 0) === 0) {
          const container = moduleContainer('currency');
          addText(container, '### 💳 Savings Account');
          addText(container, 'You have no active savings.');
          return interaction.editReply(v2Payload([container]));
        }

        const savingsBalance = Number(savings.savings_balance ?? 0);
        const unlocksAt = savings.savings_locked_until ? new Date(savings.savings_locked_until as any) : null;
        const interestRate = Number(savings.savings_interest_rate ?? 0);

        let unlocksText = 'Not locked';
        let isMatured = false;

        if (unlocksAt) {
          if (unlocksAt <= now) {
            unlocksText = 'Ready to collect!';
            isMatured = true;
          } else {
            const diffMs = unlocksAt.getTime() - now.getTime();
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            unlocksText = `${days}d ${hours}h ${minutes}m`;
          }
        }

        const expectedInterest = Math.floor(savingsBalance * interestRate);
        const totalWithInterest = savingsBalance + expectedInterest;

        const container = moduleContainer('currency');
        addText(container, '### 💳 Savings Account Status');
        addFields(container, [
          { name: 'Savings Balance', value: savingsBalance.toLocaleString(), inline: true },
          { name: 'Interest Rate', value: `${(interestRate * 100).toFixed(1)}%`, inline: true },
          { name: 'Expected Interest', value: expectedInterest.toLocaleString(), inline: true },
          { name: 'Total with Interest', value: totalWithInterest.toLocaleString(), inline: true },
          { name: isMatured ? '✅ Status' : '⏱️ Time Until Unlock', value: unlocksText, inline: false }
        ]);
        addFooter(container, `Checked at ${new Date().toLocaleString()}`);

        return interaction.editReply(v2Payload([container]));
      }
    } catch (error) {
      console.error('[Bank Savings Error]', error);
      const container = errorContainer('Savings Error', 'An error occurred with your savings.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
