import { SlashCommandBuilder, ChatInputCommandInteraction, TextDisplayBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFooter, v2Payload, errorReply } from '../../../Shared/src/utils/componentsV2';
import { getDonationConfig, getDonationLeaderboard } from '../helpers';
import { getCurrencyConfig } from '../../Currency/helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('DonationTracking:Leaderboard');

const command: BotCommand = {
  module: 'donationtracking',
  permissionPath: 'donationtracking.leaderboard',
  premiumFeature: 'donationtracking.basic',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('donation-leaderboard')
    .setDescription('View the top donation contributors'),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const config = await getDonationConfig(guildId);
      const currencyConfig = await getCurrencyConfig(guildId);

      const leaderboard = await getDonationLeaderboard(guildId, config.leaderboardSize);

      if (leaderboard.length === 0) {
        const container = moduleContainer('donation_tracking');
        addText(container, '### 💰 Donation Leaderboard\nNo donations yet. Be the first to donate!');
        return interaction.editReply(v2Payload([container]));
      }

      let description = '';
      for (let i = 0; i < leaderboard.length; i++) {
        const entry = leaderboard[i];
        const rank = i + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

        try {
          const user = await interaction.client.users.fetch(entry.userId);
          description += `${medal} **${user.username}** - ${currencyConfig.currencies[config.currencyType].emoji} **${entry.totalDonated}**\n`;
        } catch {
          description += `${medal} **Unknown User** - ${currencyConfig.currencies[config.currencyType].emoji} **${entry.totalDonated}**\n`;
        }
      }

      const container = moduleContainer('donation_tracking');
      addText(container, '### 💰 Donation Leaderboard');
      addSeparator(container, 'small');
      addText(container, description);
      addFooter(container, `Top ${config.leaderboardSize} donors`);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error(`Error in leaderboard command: ${error}`);
      return interaction.editReply(errorReply('Error', 'An error occurred while fetching the leaderboard.'));
    }
  },
};

export default command;
