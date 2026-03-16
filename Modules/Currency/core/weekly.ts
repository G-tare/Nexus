import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, successContainer } from '../../../Shared/src/utils/componentsV2';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrencyConfig, getBalance, addCurrency } from '../helpers';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.weekly',
  premiumFeature: 'currency.single',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('weekly')
    .setDescription('Claim your weekly currency reward'),
  
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
        .select({ lastWeeklyClaim: guildMembers.lastWeeklyClaim })
        .from(guildMembers)
        .where(and(
          eq(guildMembers.guildId, guildId),
          eq(guildMembers.userId, userId)
        ))
        .limit(1);

      const now = new Date();
      const lastClaim = memberRecord[0]?.lastWeeklyClaim;

      if (lastClaim) {
        const diffMs = now.getTime() - lastClaim.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays < 7) {
          const remainingMs = 7 * 24 * 60 * 60 * 1000 - diffMs;
          const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
          const remainingHours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const timeRemaining = `${remainingDays}d ${remainingHours}h`;

          return interaction.editReply({
            components: [errorContainer('Weekly Reward on Cooldown', `You can claim your weekly reward in **${timeRemaining}**.`)],
            flags: MessageFlags.IsComponentsV2,
          });
        }
      }

      const earnedAmounts: { [key: string]: number } = {};

      // Add coins if configured
      if (config.currencies.coins && config.currencies.coins.weeklyAmount > 0) {
        await addCurrency(guildId, userId, 'coins', config.currencies.coins.weeklyAmount, 'weekly_reward');
        earnedAmounts.coins = config.currencies.coins.weeklyAmount;
      }

      // Add gems if configured
      if (config.currencies.gems && config.currencies.gems.weeklyAmount > 0) {
        await addCurrency(guildId, userId, 'gems', config.currencies.gems.weeklyAmount, 'weekly_reward');
        earnedAmounts.gems = config.currencies.gems.weeklyAmount;
      }

      // Add event tokens if configured
      if (config.currencies.event_tokens && config.currencies.event_tokens.weeklyAmount > 0) {
        await addCurrency(guildId, userId, 'event_tokens', config.currencies.event_tokens.weeklyAmount, 'weekly_reward');
        earnedAmounts.event_tokens = config.currencies.event_tokens.weeklyAmount;
      }

      // Update last claim time
      await db
        .update(guildMembers)
        .set({ lastWeeklyClaim: now })
        .where(and(
          eq(guildMembers.guildId, guildId),
          eq(guildMembers.userId, userId)
        ));

      const balance = await getBalance(guildId, userId);
      let description = `You claimed your weekly reward!\n\n**Amounts Received:**\n`;

      if (earnedAmounts.coins) {
        description += `${config.currencies.coins.emoji} Coins: ${earnedAmounts.coins}\n`;
      }
      if (earnedAmounts.gems) {
        description += `${config.currencies.gems.emoji} Gems: ${earnedAmounts.gems}\n`;
      }
      if (earnedAmounts.event_tokens) {
        description += `${config.currencies.event_tokens.emoji} Event Tokens: ${earnedAmounts.event_tokens}\n`;
      }

      description += `\n**New Balance:**\n${config.currencies.coins.emoji} ${balance.coins.toLocaleString()} ${config.currencies.coins.name}`;

      if (config.currencies.gems) {
        description += `\n${config.currencies.gems.emoji} ${balance.gems.toLocaleString()} ${config.currencies.gems.name}`;
      }

      if (config.currencies.event_tokens) {
        description += `\n${config.currencies.event_tokens.emoji} ${balance.eventTokens.toLocaleString()} ${config.currencies.event_tokens.name}`;
      }

      return interaction.editReply({
        components: [successContainer('Weekly Reward Claimed!', description)],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.error('[Weekly Command Error]', error);
      return interaction.editReply({
        components: [errorContainer('Error', 'An error occurred while claiming your weekly reward.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }
};

export default command;
