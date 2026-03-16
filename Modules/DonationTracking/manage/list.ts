import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFields, addSeparator, v2Payload, errorReply } from '../../../Shared/src/utils/componentsV2';
import { getDonationConfig, getTotalDonations } from '../helpers';
import { getCurrencyConfig } from '../../Currency/helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('DonationTracking:List');

const command: BotCommand = {
  module: 'donationtracking',
  permissionPath: 'donationtracking.manage.list',
  premiumFeature: 'donationtracking.basic',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('donations')
    .setDescription('View donation campaign information'),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const config = await getDonationConfig(guildId);
      const currencyConfig = await getCurrencyConfig(guildId);

      const container = moduleContainer('donation_tracking');
      addText(container, '### 💰 Donations\nServer-wide donation information');
      addSeparator(container, 'small');

      // Current campaign
      if (config.goalActive && config.goalAmount > 0) {
        const total = await getTotalDonations(guildId);
        const percent = Math.min(100, (total / config.goalAmount) * 100);
        addFields(container, [{
          name: `Current Campaign: ${config.goalName}`,
          value: `Target: ${currencyConfig.currencies[config.currencyType].emoji} **${config.goalAmount}**\nRaised: ${currencyConfig.currencies[config.currencyType].emoji} **${total}** (${percent.toFixed(1)}%)`,
          inline: false,
        }]);
      } else {
        addFields(container, [{
          name: 'Current Campaign',
          value: 'No active campaign',
          inline: false,
        }]);
      }

      // Settings summary
      addSeparator(container, 'small');
      addFields(container, [{
        name: 'Donation Settings',
        value: [
          `Currency: ${currencyConfig.currencies[config.currencyType].name}`,
          `Min: ${currencyConfig.currencies[config.currencyType].emoji} **${config.minDonation}**`,
          `Max: ${currencyConfig.currencies[config.currencyType].emoji} **${config.maxDonation}**`,
          `Leaderboard Size: **${config.leaderboardSize}**`,
          `Milestones: ${config.announceMilestones ? '✓ Enabled' : '✗ Disabled'}`,
        ].join('\n'),
        inline: false,
      }]);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error(`Error in list command: ${error}`);
      return interaction.editReply(errorReply('Error', 'An error occurred while fetching donation information.'));
    }
  },
};

export default command;
