import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFields, addSeparator, v2Payload, errorReply, successReply } from '../../../Shared/src/utils/componentsV2';
import {
  getDonationConfig,
  recordDonation,
  getTotalDonations,
  getUserDonations,
  checkMilestones,
  getGoalProgress,
  createProgressBar,
} from '../helpers';
import { getBalance, removeCurrency, getCurrencyConfig } from '../../Currency/helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('DonationTracking:Donate');

const command: BotCommand = {
  module: 'donationtracking',
  permissionPath: 'donationtracking.donate',
  premiumFeature: 'donationtracking.basic',
  cooldown: 2,
  data: new SlashCommandBuilder()
    .setName('donate')
    .setDescription('Donate currency toward the server goal')
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Amount to donate')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('Optional message with your donation')
        .setRequired(false)
        .setMaxLength(200)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const amount = interaction.options.getInteger('amount')!;
      const message = interaction.options.getString('message') || undefined;

      const config = await getDonationConfig(guildId);
      const currencyConfig = await getCurrencyConfig(guildId);

      // Validation
      if (amount < config.minDonation || amount > config.maxDonation) {
        return interaction.editReply(errorReply(
          'Invalid Donation Amount',
          `You can donate between **${config.minDonation}** and **${config.maxDonation}** ${currencyConfig.currencies[config.currencyType].name}.`
        ));
      }

      // Check balance
      const balance = await getBalance(guildId, userId);
      const currentBalance =
        config.currencyType === 'coins'
          ? balance.coins
          : config.currencyType === 'gems'
            ? balance.gems
            : balance.eventTokens;

      if (currentBalance < amount) {
        return interaction.editReply(errorReply(
          'Insufficient Balance',
          `You need **${amount}** ${currencyConfig.currencies[config.currencyType].name}, but you only have **${currentBalance}**.`
        ));
      }

      // Remove currency
      const result = await removeCurrency(guildId, userId, config.currencyType, amount, 'donation', {
        campaignName: config.goalName,
      });

      if (!result.success) {
        return interaction.editReply(errorReply('Donation Failed', 'Failed to process your donation. Please try again.'));
      }

      // Record donation
      const oldTotal = await getTotalDonations(guildId);
      await recordDonation(guildId, userId, amount, config.currencyType, config.goalName, message);
      const newTotal = oldTotal + amount;

      // Create success container
      const container = moduleContainer('donation_tracking');
      addText(container, `### Donation Received\nThank you for donating **${amount}** ${currencyConfig.currencies[config.currencyType].emoji}!`);
      addSeparator(container, 'small');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        { name: 'Your New Balance', value: `${result.newBalance}`, inline: true },
        { name: 'Total Goal Donations', value: `${newTotal}`, inline: true }
      ];

      if (message) {
        fields.push({ name: 'Your Message', value: message });
      }

      // Check for milestones
      const progress = await getGoalProgress(guildId);
      if (progress.goalActive && progress.goal > 0) {
        const milestones = checkMilestones(oldTotal, newTotal, progress.goal, config.milestonePercents);

        if (milestones.length > 0 && config.announceMilestones) {
          const progressBar = createProgressBar(newTotal, progress.goal);
          fields.push(
            { name: 'Goal Progress', value: `\`${progressBar}\`\n${newTotal} / ${progress.goal}` },
            {
              name: 'Milestones Crossed',
              value: milestones.map((m) => `${m.percent}% (${m.amount})`).join(', '),
            }
          );

          // Announce to log channel if configured
          if (config.logChannelId && config.announceMilestones) {
            try {
              const channel = await interaction.client.channels.fetch(config.logChannelId);
              if (channel?.isTextBased()) {
                const announcementContainer = moduleContainer('donation_tracking');
                addText(announcementContainer, `### 🎉 Milestone Reached!\nThe server has reached **${milestones[0].percent}%** of the donation goal!`);
                addSeparator(announcementContainer, 'small');
                addFields(announcementContainer, [
                  { name: 'Goal Name', value: config.goalName || 'Donation Goal' },
                  { name: 'Progress', value: `\`${progressBar}\`\n${newTotal} / ${progress.goal}` }
                ]);
                await (channel as any).send(v2Payload([announcementContainer])).catch(() => {
                  // Non-critical
                });
              }
            } catch {
              // Non-critical
            }
          }
        } else if (progress.goalActive && !milestones.length) {
          const progressBar = createProgressBar(newTotal, progress.goal);
          fields.push({
            name: 'Goal Progress',
            value: `\`${progressBar}\`\n${newTotal} / ${progress.goal}`,
          });
        }
      }

      addFields(container, fields);
      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error(`Error in donate command: ${error}`);
      return interaction.editReply(errorReply('Error', 'An error occurred while processing your donation.'));
    }
  },
};

export default command;
