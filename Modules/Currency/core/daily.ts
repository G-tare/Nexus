import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, successContainer } from '../../../Shared/src/utils/componentsV2';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrencyConfig, getBalance, addCurrency, calculateStreakMultiplier } from '../helpers';
import { eventBus } from '../../../Shared/src/events/eventBus';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.daily',
  premiumFeature: 'currency.single',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily currency reward'),
  
  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      if (!guildId) {
        return interaction.editReply({
          components: [errorContainer('Error', 'This command can only be used in a server.')],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const config = await getCurrencyConfig(guildId);
      const db = getDb();

      const memberRecord = await db
        .select({ 
          lastDailyClaim: guildMembers.lastDailyClaim,
          dailyStreak: guildMembers.dailyStreak
        })
        .from(guildMembers)
        .where(and(
          eq(guildMembers.guildId, guildId),
          eq(guildMembers.userId, userId)
        ))
        .limit(1);

      const now = new Date();
      const lastClaim = memberRecord[0]?.lastDailyClaim;
      const currentStreak = memberRecord[0]?.dailyStreak || 0;

      let newStreak = currentStreak;
      let showTimeRemaining = false;
      let timeRemaining = '';

      if (lastClaim) {
        const diffMs = now.getTime() - lastClaim.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 24) {
          // Can't claim yet
          showTimeRemaining = true;
          const remainingMs = 24 * 60 * 60 * 1000 - diffMs;
          const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
          const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          timeRemaining = `${remainingHours}h ${remainingMinutes}m`;

          return interaction.editReply({
            components: [errorContainer('Daily Reward on Cooldown', `You can claim your daily reward in **${timeRemaining}**.`)],
            flags: MessageFlags.IsComponentsV2,
          });
        } else if (diffHours < 48) {
          // Increment streak
          newStreak = currentStreak + 1;
        } else {
          // Reset streak
          newStreak = 1;
        }
      } else {
        newStreak = 1;
      }

      const coinsConfig = config.currencies.coins;
      const multiplier = calculateStreakMultiplier(
        newStreak,
        config.streakBonusMultiplier,
        config.streakMaxMultiplier
      );

      const coinAmount = Math.floor(coinsConfig.dailyAmount * multiplier);

      // Add coins
      await addCurrency(guildId, userId, 'coins', coinAmount, 'daily_reward');

      // Add gems if configured
      if (config.currencies.gems && config.currencies.gems.dailyAmount > 0) {
        await addCurrency(guildId, userId, 'gems', config.currencies.gems.dailyAmount, 'daily_reward');
      }

      // Update last claim time and streak
      await db
        .update(guildMembers)
        .set({
          lastDailyClaim: now,
          dailyStreak: newStreak
        })
        .where(and(
          eq(guildMembers.guildId, guildId),
          eq(guildMembers.userId, userId)
        ));

      // Emit event
      eventBus.emit('dailyClaimed', {
        guildId,
        userId,
        streak: newStreak,
        multiplier,
      });

      const balance = await getBalance(guildId, userId);
      let description = `You claimed your daily reward!\n\n**${coinsConfig.emoji} Coins Earned:** ${coinAmount}`;

      if (config.currencies.gems && config.currencies.gems.dailyAmount > 0) {
        description += `\n**${config.currencies.gems.emoji} Gems Earned:** ${config.currencies.gems.dailyAmount}`;
      }

      description += `\n\n**Current Streak:** ${newStreak} days`;
      description += `\n**Multiplier:** ${multiplier.toFixed(2)}x`;
      description += `\n\n**New Balance:**\n${coinsConfig.emoji} ${balance.coins.toLocaleString()} ${coinsConfig.name}`;

      if (config.currencies.gems) {
        description += `\n${config.currencies.gems.emoji} ${balance.gems.toLocaleString()} ${config.currencies.gems.name}`;
      }

      return interaction.editReply({
        components: [successContainer('Daily Reward Claimed!', description)],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.error('[Daily Command Error]', error);
      return interaction.editReply({
        components: [errorContainer('Error', 'An error occurred while claiming your daily reward.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }
};

export default command;
