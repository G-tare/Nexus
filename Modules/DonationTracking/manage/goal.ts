import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFields, addSeparator, v2Payload, successReply, errorReply, infoReply } from '../../../Shared/src/utils/componentsV2';
import {
  getDonationConfig,
  updateDonationConfig,
  getGoalProgress,
  createProgressBar,
} from '../helpers';
import { getCurrencyConfig } from '../../Currency/helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('DonationTracking:Goal');

const command: BotCommand = {
  module: 'donationtracking',
  permissionPath: 'donationtracking.manage.goal',
  premiumFeature: 'donationtracking.basic',
  data: new SlashCommandBuilder()
    .setName('goal')
    .setDescription('Manage donation goals')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set a new donation goal')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name of the goal')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Target amount')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View the current donation goal')
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('Clear the current donation goal')
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      const guildId = interaction.guildId!;
      const config = await getDonationConfig(guildId);
      const currencyConfig = await getCurrencyConfig(guildId);
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'set') {
        await interaction.deferReply();

        const name = interaction.options.getString('name')!;
        const amount = interaction.options.getInteger('amount')!;

        await updateDonationConfig(guildId, {
          goalName: name,
          goalAmount: amount,
          goalActive: true,
        });

        return interaction.editReply(successReply('Goal Set', `**Goal Name:** ${name}\n**Target Amount:** ${currencyConfig.currencies[config.currencyType].emoji} **${amount}**`));
      } else if (subcommand === 'view') {
        await interaction.deferReply();

        if (!config.goalActive || config.goalAmount <= 0) {
          return interaction.editReply(infoReply('Donation Goal', 'No active goal is currently set.'));
        }

        const progress = await getGoalProgress(guildId);
        const progressBar = createProgressBar(progress.current, progress.goal, 20);

        const container = moduleContainer('donation_tracking');
        addText(container, `### ${config.goalName}`);
        addSeparator(container, 'small');
        addFields(container, [
          {
            name: 'Progress',
            value: `\`\`\`\n${progressBar}\n\`\`\``,
            inline: false,
          },
          {
            name: 'Current',
            value: `${currencyConfig.currencies[config.currencyType].emoji} **${progress.current}**`,
            inline: true,
          },
          {
            name: 'Target',
            value: `${currencyConfig.currencies[config.currencyType].emoji} **${progress.goal}**`,
            inline: true,
          },
          {
            name: 'Remaining',
            value: `${currencyConfig.currencies[config.currencyType].emoji} **${progress.remaining}**`,
            inline: true,
          }
        ]);

        return interaction.editReply(v2Payload([container]));
      } else if (subcommand === 'clear') {
        await interaction.deferReply();

        await updateDonationConfig(guildId, {
          goalActive: false,
          goalAmount: 0,
          goalName: '',
        });

        return interaction.editReply(successReply('Goal Cleared', 'The current donation goal has been removed.'));
      }

      return interaction.reply({
        ...errorReply('Error', 'Unknown subcommand.'),
        ephemeral: true,
      });
    } catch (error) {
      logger.error(`Error in goal command: ${error}`);
      return interaction.reply({
        ...errorReply('Error', 'An error occurred.'),
        ephemeral: true,
      });
    }
  },
};

export default command;
