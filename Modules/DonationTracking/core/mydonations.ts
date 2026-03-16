import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFields, addSeparator, v2Payload, errorReply, addSectionWithThumbnail } from '../../../Shared/src/utils/componentsV2';
import { getUserDonations, getUserDonationHistory } from '../helpers';
import { getCurrencyConfig } from '../../Currency/helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('DonationTracking:MyDonations');

const command: BotCommand = {
  module: 'donationtracking',
  permissionPath: 'donationtracking.mydonations',
  premiumFeature: 'donationtracking.basic',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('mydonations')
    .setDescription('View your donation history and total'),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      const totalDonated = await getUserDonations(guildId, userId);
      const history = await getUserDonationHistory(guildId, userId, 5);
      const currencyConfig = await getCurrencyConfig(guildId);

      const container = moduleContainer('donation_tracking');
      addSectionWithThumbnail(
        container,
        `### Your Donation History\n**Total Donated:** ${currencyConfig.currencies.coins.emoji} **${totalDonated}**`,
        interaction.user.displayAvatarURL()
      );
      addSeparator(container, 'small');

      if (history.length === 0) {
        addFields(container, [{
          name: 'Recent Donations',
          value: 'You haven\'t donated yet.',
        }]);
      } else {
        let historyText = '';
        for (const donation of history) {
          const date = new Date(donation.createdAt).toLocaleDateString();
          const message = donation.message ? ` - "${donation.message}"` : '';
          historyText += `• **${donation.amount}** on ${date}${message}\n`;
        }
        addFields(container, [{
          name: 'Recent Donations (Last 5)',
          value: historyText,
        }]);
      }

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error(`Error in mydonations command: ${error}`);
      return interaction.editReply(errorReply('Error', 'An error occurred while fetching your donation history.'));
    }
  },
};

export default command;
