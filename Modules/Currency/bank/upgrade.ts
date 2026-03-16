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

const LIMIT_UPGRADES = [
  { from: 10000, to: 25000, cost: 5000 },
  { from: 25000, to: 50000, cost: 15000 },
  { from: 50000, to: 100000, cost: 40000 },
  { from: 100000, to: 250000, cost: 100000 },
  { from: 250000, to: 999999999, cost: 500000 },
];

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.bank',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('bank-upgrade')
    .setDescription('Upgrade your daily deposit limit'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      await interaction.deferReply();
      await ensureBankAccount(guildId, userId);

      const db = getDb();
      const bankData = await db.execute(sql`
        SELECT deposit_limit FROM banks
        WHERE guild_id = ${guildId} AND user_id = ${userId}
        LIMIT 1
      ` as any);

      const currentLimit = bankData?.rows[0]?.deposit_limit ? Number(bankData.rows[0].deposit_limit) : 10000;

      // Find applicable upgrade
      let applicableUpgrade = null;
      for (const upgrade of LIMIT_UPGRADES) {
        if (upgrade.from === currentLimit) {
          applicableUpgrade = upgrade;
          break;
        }
      }

      if (!applicableUpgrade) {
        const container = errorContainer('Max Limit Reached', 'Your deposit limit is already at maximum!');
        return interaction.editReply(v2Payload([container]));
      }

      // Check wallet balance
      const result = await removeCurrency(guildId, userId, 'coins', applicableUpgrade.cost, 'deposit_limit_upgrade');

      if (!result.success) {
        const container = errorContainer('Insufficient Coins', `You need ${applicableUpgrade.cost.toLocaleString()} coins to upgrade. You have ${result.newBalance}.`);
        return interaction.editReply(v2Payload([container]));
      }

      // Update deposit limit
      await db.execute(sql`
        UPDATE banks
        SET deposit_limit = ${applicableUpgrade.to}, daily_deposited = 0
        WHERE guild_id = ${guildId} AND user_id = ${userId}
      `);

      const container = moduleContainer('currency');
      addText(container, '### 📈 Deposit Limit Upgraded!');
      addText(container, 'Your daily deposit limit has been increased!');
      addFields(container, [
        { name: 'Previous Limit', value: `${applicableUpgrade.from.toLocaleString()}`, inline: true },
        { name: 'New Limit', value: `${applicableUpgrade.to.toLocaleString()}`, inline: true },
        { name: 'Cost', value: `${applicableUpgrade.cost.toLocaleString()} coins`, inline: false }
      ]);
      addFooter(container, `Upgraded at ${new Date().toLocaleString()}`);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Bank Upgrade Error]', error);
      const container = errorContainer('Upgrade Error', 'An error occurred while upgrading your deposit limit.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
