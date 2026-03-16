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
import { addCurrency, ensureBankAccount } from '../helpers';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.bank',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('bank-collect')
    .setDescription('Collect matured savings with interest'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      await interaction.deferReply();
      await ensureBankAccount(guildId, userId);

      const db = getDb();
      const savingsData = await db.execute(sql`
        SELECT
          savings_balance,
          savings_locked_until,
          savings_interest_rate
        FROM banks
        WHERE guild_id = ${guildId} AND user_id = ${userId}
        LIMIT 1
      ` as any);

      const savings = savingsData?.rows[0];

      if (!savings || Number(savings.savings_balance ?? 0) === 0) {
        const container = errorContainer('No Savings', 'You have no savings to collect.');
        return interaction.editReply(v2Payload([container]));
      }

      const savingsBalance = Number(savings.savings_balance ?? 0);
      const unlocksAt = savings.savings_locked_until ? new Date(savings.savings_locked_until as any) : null;
      const interestRate = Number(savings.savings_interest_rate ?? 0);
      const now = new Date();

      if (!unlocksAt || unlocksAt > now) {
        const timeRemaining = unlocksAt ?
          `<t:${Math.floor(unlocksAt.getTime() / 1000)}:R>` : 'Unknown';

        const container = errorContainer('Savings Not Matured', `Your savings are not ready yet. They unlock ${timeRemaining}.`);
        return interaction.editReply(v2Payload([container]));
      }

      // Calculate interest
      const interestAmount = Math.floor(savingsBalance * interestRate);
      const totalWithInterest = savingsBalance + interestAmount;

      // Add to wallet via bank
      await db.execute(sql`
        UPDATE banks
        SET savings_balance = 0,
            savings_locked_until = NULL,
            savings_interest_rate = NULL,
            savings_deposited_at = NULL,
            last_interest_paid = NULL
        WHERE guild_id = ${guildId} AND user_id = ${userId}
      `);

      // Transfer to wallet
      await addCurrency(guildId, userId, 'coins', totalWithInterest, 'savings_collection', {
        principal: savingsBalance,
        interest: interestAmount,
        rate: interestRate,
      });

      const container = moduleContainer('currency');
      addText(container, '### 💰 Savings Collected!');
      addText(container, 'Your savings have been added to your wallet.');
      addFields(container, [
        { name: 'Principal', value: savingsBalance.toLocaleString(), inline: true },
        { name: 'Interest Earned', value: interestAmount.toLocaleString(), inline: true },
        { name: 'Total Collected', value: totalWithInterest.toLocaleString(), inline: false }
      ]);
      addFooter(container, `Collected at ${new Date().toLocaleString()}`);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Bank Collect Error]', error);
      const container = errorContainer('Collection Error', 'An error occurred while collecting your savings.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
