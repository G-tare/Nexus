import { SlashCommandBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  errorContainer,
  moduleContainer,
  addText,
  addFields,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { getBalance, addCurrency, removeCurrency, checkEarnCooldown, setEarnCooldown, getBankBalance, getCurrencyConfig } from '../helpers';
import { getDb } from '../../../Shared/src/database/connection';
import { sql } from 'drizzle-orm';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.earn',
  cooldown: 2,
  data: new SlashCommandBuilder()
    .setName('earn-rob')
    .setDescription('Rob another user (300s cooldown)')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to rob').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const robber = interaction.user;
      const target = interaction.options.getUser('user', true);

      // Validation
      if (target.bot) {
        const container = errorContainer('Invalid Target', "You can't rob a bot!");
        return interaction.reply({ ...v2Payload([container]), ephemeral: true });
      }

      if (robber.id === target.id) {
        const container = errorContainer('Invalid Target', "You can't rob yourself!");
        return interaction.reply({ ...v2Payload([container]), ephemeral: true });
      }

      // Check cooldown
      const cooldownRemaining = await checkEarnCooldown(guildId, robber.id, 'rob');
      if (cooldownRemaining > 0) {
        const container = errorContainer('On Cooldown', `You need to hide. Wait ${cooldownRemaining}s.`);
        return interaction.reply({ ...v2Payload([container]), ephemeral: true });
      }

      await interaction.deferReply();

      const targetBalance = await getBalance(guildId, target.id);
      const targetBank = await getBankBalance(guildId, target.id);

      // Check if target has enough coins (min 100)
      if (targetBalance.coins < 100) {
        const container = errorContainer('Target Too Poor', `${target.username} doesn't have enough coins (needs at least 100)!`);
        return interaction.editReply(v2Payload([container]));
      }

      // Check padlock
      if (targetBank.padlockActive && targetBank.padlockExpires && targetBank.padlockExpires > new Date()) {
        const container = errorContainer('Protected Target', `${target.username}'s bank is protected by a padlock! You can't rob them.`);
        return interaction.editReply(v2Payload([container]));
      }

      const config = await getCurrencyConfig(guildId);
      const robChance = (config as any).robChance || 40;
      const success = Math.random() * 100 < robChance;

      const db = getDb();
      let description = '';

      if (success) {
        // Steal 10-50% of target's wallet
        const stealPercent = Math.random() * (50 - 10) + 10;
        const stealAmount = Math.floor(targetBalance.coins * (stealPercent / 100));

        // Transfer from target
        await removeCurrency(guildId, target.id, 'coins', stealAmount, 'robbery', { robber: robber.id });

        // Add to robber
        await addCurrency(guildId, robber.id, 'coins', stealAmount, 'robbery', { target: target.id });

        description = `🎉 **Success!** You robbed ${target.username} and stole **${stealAmount} coins**!`;

        await db.execute(sql`
          INSERT INTO crime_logs (guild_id, user_id, action_type, crime_type, success, amount_gained, target_id, created_at)
          VALUES (${guildId}, ${robber.id}, 'robbery', 'rob', true, ${stealAmount}, ${target.id}, NOW())
        `);
      } else {
        // Lose 10-20% of robber's wallet
        const losePercent = Math.random() * (20 - 10) + 10;
        const loseAmount = Math.floor(targetBalance.coins * (losePercent / 100));

        const robberBalance = await getBalance(guildId, robber.id);
        const actualLoss = Math.min(loseAmount, robberBalance.coins);

        if (actualLoss > 0) {
          await removeCurrency(guildId, robber.id, 'coins', actualLoss, 'robbery_fail', { target: target.id });
          await addCurrency(guildId, target.id, 'coins', actualLoss, 'robbery_defense', { robber: robber.id });
          description = `❌ **Failed!** ${target.username} caught you and took **${actualLoss} coins** from you!`;
        } else {
          description = `❌ **Failed!** ${target.username} caught you, but you had no coins to lose!`;
        }

        await db.execute(sql`
          INSERT INTO crime_logs (guild_id, user_id, action_type, crime_type, success, amount_lost, target_id, created_at)
          VALUES (${guildId}, ${robber.id}, 'robbery', 'rob', false, ${actualLoss}, ${target.id}, NOW())
        `);
      }

      const robberNewBalance = await getBalance(guildId, robber.id);
      const targetNewBalance = await getBalance(guildId, target.id);

      const container = moduleContainer('currency');
      addText(container, '### 💰 Robbery Results');
      addText(container, description);
      addFields(container, [
        { name: 'Your Balance', value: `${robberNewBalance.coins.toLocaleString()}`, inline: true },
        { name: `${target.username}'s Balance`, value: `${targetNewBalance.coins.toLocaleString()}`, inline: true }
      ]);
      addFooter(container, `Robbery attempt at ${new Date().toLocaleString()}`);

      // Set cooldown
      await setEarnCooldown(guildId, robber.id, 'rob', 300);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Earn Rob Error]', error);
      const container = errorContainer('Robbery Error', 'An error occurred while robbing.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
