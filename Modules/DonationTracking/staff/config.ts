import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFields, addSeparator, v2Payload, successReply, errorReply } from '../../../Shared/src/utils/componentsV2';
import { getDonationConfig, updateDonationConfig } from '../helpers';
import { getCurrencyConfig } from '../../Currency/helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('DonationTracking:Config');

const command: BotCommand = {
  module: 'donationtracking',
  permissionPath: 'donationtracking.staff.config',
  premiumFeature: 'donationtracking.advanced',
  data: new SlashCommandBuilder()
    .setName('donationconfig')
    .setDescription('Configure donation tracking settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View current settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Set the default donation announcement channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel for announcements (or null to disable)')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('currency')
        .setDescription('Set the currency type for donations')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Currency type')
            .setRequired(true)
            .addChoices(
              { name: 'Coins', value: 'coins' },
              { name: 'Gems', value: 'gems' },
              { name: 'Event Tokens', value: 'event_tokens' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('goal-amount')
        .setDescription('Set the goal amount')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Target amount')
            .setRequired(true)
            .setMinValue(0)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('goal-name')
        .setDescription('Set the goal name')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Goal name')
            .setRequired(true)
            .setMaxLength(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('goal-toggle')
        .setDescription('Enable or disable the goal')
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable or disable')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('min-donation')
        .setDescription('Set minimum donation amount')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Minimum amount')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-donation')
        .setDescription('Set maximum donation amount')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Maximum amount')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('milestone-toggle')
        .setDescription('Enable or disable milestone announcements')
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable or disable')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('leaderboard-size')
        .setDescription('Set leaderboard display size')
        .addIntegerOption((option) =>
          option
            .setName('size')
            .setDescription('Number of entries to show')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('color')
        .setDescription('Set the embed color')
        .addStringOption((option) =>
          option
            .setName('hex')
            .setDescription('Hex color code (e.g., #2ECC71)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('log-channel')
        .setDescription('Set the milestone log channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel for logs')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const config = await getDonationConfig(guildId);
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'view') {
        const currencyConfig = await getCurrencyConfig(guildId);
        const currencyName = currencyConfig.currencies[config.currencyType as 'coins' | 'gems' | 'event_tokens'].name;

        const container = moduleContainer('donation_tracking');
        addText(container, '### Donation Configuration');
        addSeparator(container, 'small');
        addFields(container, [
          { name: 'Currency', value: currencyName, inline: true },
          { name: 'Goal Active', value: config.goalActive ? '✓' : '✗', inline: true },
          { name: 'Goal Name', value: config.goalName || 'None', inline: true },
          { name: 'Goal Amount', value: config.goalAmount.toString(), inline: true },
          { name: 'Min Donation', value: config.minDonation.toString(), inline: true },
          { name: 'Max Donation', value: config.maxDonation.toString(), inline: true },
          { name: 'Leaderboard Size', value: config.leaderboardSize.toString(), inline: true },
          { name: 'Milestones Enabled', value: config.announceMilestones ? '✓' : '✗', inline: true },
          { name: 'Color', value: config.embedColor, inline: true }
        ]);

        return interaction.editReply(v2Payload([container]));
      }

      // Update configurations
      if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('channel');
        await updateDonationConfig(guildId, {
          defaultChannelId: channel?.id ?? null,
        });
        return interaction.editReply(successReply('Updated', `Default channel set to ${channel?.toString() || 'None'}`));
      }

      if (subcommand === 'currency') {
        const type = interaction.options.getString('type') as 'coins' | 'gems' | 'event_tokens';
        await updateDonationConfig(guildId, { currencyType: type });
        return interaction.editReply(successReply('Updated', `Currency type set to **${type}**`));
      }

      if (subcommand === 'goal-amount') {
        const amount = interaction.options.getInteger('amount')!;
        await updateDonationConfig(guildId, { goalAmount: amount });
        return interaction.editReply(successReply('Updated', `Goal amount set to **${amount}**`));
      }

      if (subcommand === 'goal-name') {
        const name = interaction.options.getString('name')!;
        await updateDonationConfig(guildId, { goalName: name });
        return interaction.editReply(successReply('Updated', `Goal name set to **${name}**`));
      }

      if (subcommand === 'goal-toggle') {
        const enabled = interaction.options.getBoolean('enabled')!;
        await updateDonationConfig(guildId, { goalActive: enabled });
        return interaction.editReply(successReply('Updated', `Goal ${enabled ? 'enabled' : 'disabled'}`));
      }

      if (subcommand === 'min-donation') {
        const amount = interaction.options.getInteger('amount')!;
        await updateDonationConfig(guildId, { minDonation: amount });
        return interaction.editReply(successReply('Updated', `Minimum donation set to **${amount}**`));
      }

      if (subcommand === 'max-donation') {
        const amount = interaction.options.getInteger('amount')!;
        await updateDonationConfig(guildId, { maxDonation: amount });
        return interaction.editReply(successReply('Updated', `Maximum donation set to **${amount}**`));
      }

      if (subcommand === 'milestone-toggle') {
        const enabled = interaction.options.getBoolean('enabled')!;
        await updateDonationConfig(guildId, { announceMilestones: enabled });
        return interaction.editReply(successReply('Updated', `Milestone announcements ${enabled ? 'enabled' : 'disabled'}`));
      }

      if (subcommand === 'leaderboard-size') {
        const size = interaction.options.getInteger('size')!;
        await updateDonationConfig(guildId, { leaderboardSize: size });
        return interaction.editReply(successReply('Updated', `Leaderboard size set to **${size}**`));
      }

      if (subcommand === 'color') {
        const hex = interaction.options.getString('hex')!;
        if (!/^#[0-9A-F]{6}$/i.test(hex)) {
          return interaction.editReply(errorReply('Invalid Color', 'Please provide a valid hex color code (e.g., #2ECC71)'));
        }
        await updateDonationConfig(guildId, { embedColor: hex });
        return interaction.editReply(successReply('Updated', `Color set to **${hex}**`));
      }

      if (subcommand === 'log-channel') {
        const channel = interaction.options.getChannel('channel');
        await updateDonationConfig(guildId, {
          logChannelId: channel?.id ?? null,
        });
        return interaction.editReply(successReply('Updated', `Log channel set to ${channel?.toString() || 'None'}`));
      }

      return interaction.editReply(errorReply('Error', 'Unknown subcommand.'));
    } catch (error) {
      logger.error(`Error in config command: ${error}`);
      return interaction.editReply(errorReply('Error', 'An error occurred.'));
    }
  },
};

export default command;
