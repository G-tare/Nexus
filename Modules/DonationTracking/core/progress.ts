import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFields, addSeparator, addFooter, v2Payload, errorReply, infoReply } from '../../../Shared/src/utils/componentsV2';
import { getGoalProgress, createProgressBar } from '../helpers';
import { getCurrencyConfig } from '../../Currency/helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('DonationTracking:Progress');

const command: BotCommand = {
  module: 'donationtracking',
  permissionPath: 'donationtracking.progress',
  premiumFeature: 'donationtracking.basic',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('progress')
    .setDescription('View the current donation goal progress'),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const progress = await getGoalProgress(guildId);
      const currencyConfig = await getCurrencyConfig(guildId);

      if (!progress.goalActive || progress.goal <= 0) {
        return interaction.editReply(infoReply('Donation Goal', 'No active donation goal at the moment.'));
      }

      const progressBar = createProgressBar(progress.current, progress.goal, 20);
      const emoji = currencyConfig.currencies[progress.percent === 100 ? 'coins' : 'coins'].emoji;

      const container = moduleContainer('donation_tracking');
      addText(container, `### ${progress.goalName || 'Donation Goal'}`);
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'Progress',
          value: `\`\`\`\n${progressBar}\n\`\`\``,
          inline: false,
        },
        {
          name: 'Raised',
          value: `${emoji} **${progress.current.toLocaleString()}**`,
          inline: true,
        },
        {
          name: 'Goal',
          value: `${emoji} **${progress.goal.toLocaleString()}**`,
          inline: true,
        },
        {
          name: 'Remaining',
          value: `${emoji} **${progress.remaining.toLocaleString()}**`,
          inline: true,
        }
      ]);

      if (progress.percent === 100) {
        addFooter(container, '✅ Goal completed!');
      }

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error(`Error in progress command: ${error}`);
      return interaction.editReply(errorReply('Error', 'An error occurred while fetching the progress.'));
    }
  },
};

export default command;
