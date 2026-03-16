import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, successContainer } from '../../../Shared/src/utils/componentsV2';
import { getCurrencyConfig, CurrencyType } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

export default {
  data: new SlashCommandBuilder()
    .setName('currency-config')
    .setDescription('Configure currency settings')
    .addSubcommand((sub) =>
      sub
        .setName('name')
        .setDescription('Set currency name and emoji')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Type of currency')
            .setRequired(true)
            .addChoices(
              { name: 'Coins', value: 'coins' },
              { name: 'Gems', value: 'gems' },
              { name: 'Event Tokens', value: 'event_tokens' }
            )
        )
        .addStringOption((option) =>
          option.setName('name').setDescription('Currency name').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('emoji').setDescription('Currency emoji').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('daily')
        .setDescription('Set daily reward amount')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Type of currency')
            .setRequired(true)
            .addChoices(
              { name: 'Coins', value: 'coins' },
              { name: 'Gems', value: 'gems' },
              { name: 'Event Tokens', value: 'event_tokens' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Daily amount')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(10000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('weekly')
        .setDescription('Set weekly reward amount')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Type of currency')
            .setRequired(true)
            .addChoices(
              { name: 'Coins', value: 'coins' },
              { name: 'Gems', value: 'gems' },
              { name: 'Event Tokens', value: 'event_tokens' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Weekly amount')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(50000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('send-cap')
        .setDescription('Set daily send cap')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Daily send cap')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(1000000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('receive-cap')
        .setDescription('Set daily receive cap')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Daily receive cap')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(1000000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('tax')
        .setDescription('Set transaction tax percentage')
        .addIntegerOption((option) =>
          option
            .setName('percentage')
            .setDescription('Tax percentage')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(25)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('message-earn')
        .setDescription('Set currency earned per message')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Type of currency')
            .setRequired(true)
            .addChoices(
              { name: 'Coins', value: 'coins' },
              { name: 'Gems', value: 'gems' },
              { name: 'Event Tokens', value: 'event_tokens' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Amount per message')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100)
        )
        .addIntegerOption((option) =>
          option
            .setName('cooldown')
            .setDescription('Cooldown in seconds')
            .setRequired(true)
            .setMinValue(10)
            .setMaxValue(600)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('voice-earn')
        .setDescription('Set currency earned per voice minute')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Type of currency')
            .setRequired(true)
            .addChoices(
              { name: 'Coins', value: 'coins' },
              { name: 'Gems', value: 'gems' },
              { name: 'Event Tokens', value: 'event_tokens' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Amount per minute')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(50)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('banking')
        .setDescription('Toggle banking system')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Enable or disable').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('savings')
        .setDescription('Toggle savings accounts')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Enable or disable').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('robbery')
        .setDescription('Toggle rob command')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Enable or disable').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('earning')
        .setDescription('Toggle all earning actions')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Enable or disable').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('jobs')
        .setDescription('Toggle job system')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Enable or disable').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('job-slacking')
        .setDescription('Toggle game-slacking detection')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Enable or disable').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('slacking-threshold')
        .setDescription('Game commands before boss notices')
        .addIntegerOption((option) =>
          option
            .setName('threshold')
            .setDescription('Threshold (5-100)')
            .setRequired(true)
            .setMinValue(5)
            .setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('jail-duration')
        .setDescription('Jail duration in seconds')
        .addIntegerOption((option) =>
          option
            .setName('duration')
            .setDescription('Duration in seconds (60-3600)')
            .setRequired(true)
            .setMinValue(60)
            .setMaxValue(3600)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('crime-fine-multiplier')
        .setDescription('Fine multiplier for failed crimes')
        .addNumberOption((option) =>
          option
            .setName('multiplier')
            .setDescription('Multiplier (0.5-3.0)')
            .setRequired(true)
            .setMinValue(0.5)
            .setMaxValue(3.0)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('rob-chance')
        .setDescription('Base robbery success chance %')
        .addIntegerOption((option) =>
          option
            .setName('percentage')
            .setDescription('Percentage (10-80)')
            .setRequired(true)
            .setMinValue(10)
            .setMaxValue(80)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('monthly-amount')
        .setDescription('Monthly bonus coin amount')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Amount in coins')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('monthly-gems')
        .setDescription('Monthly bonus gem amount')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Amount in gems')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(1000)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    ,

  module: 'currency',
  permissionPath: 'currency.config',
  premiumFeature: 'currency.single',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const config = await getCurrencyConfig(guildId);

      if (subcommand === 'name') {
        const type = interaction.options.getString('type', true) as CurrencyType;
        const name = interaction.options.getString('name', true);
        const emoji = interaction.options.getString('emoji', true);

        config.currencies[type].name = name;
        config.currencies[type].emoji = emoji;

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Currency Name Updated', `**Type:** ${type}\n**Name:** ${name}\n**Emoji:** ${emoji}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'daily') {
        const type = interaction.options.getString('type', true) as CurrencyType;
        const amount = interaction.options.getInteger('amount', true);

        config.currencies[type].dailyAmount = amount;

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Daily Reward Updated', `**Type:** ${type}\n**New Daily Amount:** ${amount}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'weekly') {
        const type = interaction.options.getString('type', true) as CurrencyType;
        const amount = interaction.options.getInteger('amount', true);

        config.currencies[type].weeklyAmount = amount;

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Weekly Reward Updated', `**Type:** ${type}\n**New Weekly Amount:** ${amount}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'send-cap') {
        const amount = interaction.options.getInteger('amount', true);

        config.sendCap = amount;

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Send Cap Updated', `**New Send Cap:** ${amount}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'receive-cap') {
        const amount = interaction.options.getInteger('amount', true);

        config.receiveCap = amount;

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Receive Cap Updated', `**New Receive Cap:** ${amount}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'tax') {
        const percentage = interaction.options.getInteger('percentage', true);

        config.taxPercent = percentage;

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Tax Updated', `**New Tax:** ${percentage}%`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'message-earn') {
        const type = interaction.options.getString('type', true) as CurrencyType;
        const amount = interaction.options.getInteger('amount', true);
        const cooldown = interaction.options.getInteger('cooldown', true);

        config.messageEarn = { type, amount, cooldownSeconds: cooldown };

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Message Earn Updated', `**Type:** ${type}\n**Amount Per Message:** ${amount}\n**Cooldown:** ${cooldown}s`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'voice-earn') {
        const type = interaction.options.getString('type', true) as CurrencyType;
        const amount = interaction.options.getInteger('amount', true);

        config.voiceEarn = { type, amountPerMinute: amount };

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Voice Earn Updated', `**Type:** ${type}\n**Amount Per Minute:** ${amount}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'banking') {
        const enabled = interaction.options.getBoolean('enabled', true);
        (config as any).banking = enabled;
        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer(`Banking System ${enabled ? 'Enabled' : 'Disabled'}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'savings') {
        const enabled = interaction.options.getBoolean('enabled', true);
        (config as any).savings = enabled;
        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer(`Savings Accounts ${enabled ? 'Enabled' : 'Disabled'}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'robbery') {
        const enabled = interaction.options.getBoolean('enabled', true);
        (config as any).robbery = enabled;
        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer(`Robbery System ${enabled ? 'Enabled' : 'Disabled'}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'earning') {
        const enabled = interaction.options.getBoolean('enabled', true);
        (config as any).earning = enabled;
        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer(`Earning Actions ${enabled ? 'Enabled' : 'Disabled'}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'jobs') {
        const enabled = interaction.options.getBoolean('enabled', true);
        (config as any).jobs = enabled;
        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer(`Job System ${enabled ? 'Enabled' : 'Disabled'}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'job-slacking') {
        const enabled = interaction.options.getBoolean('enabled', true);
        (config as any).jobSlacking = enabled;
        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer(`Job Slacking Detection ${enabled ? 'Enabled' : 'Disabled'}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'slacking-threshold') {
        const threshold = interaction.options.getInteger('threshold', true);
        (config as any).slackingThreshold = threshold;
        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Slacking Threshold Updated', `**New Threshold:** ${threshold}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'jail-duration') {
        const duration = interaction.options.getInteger('duration', true);
        (config as any).jailDuration = duration;
        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Jail Duration Updated', `**Duration:** ${duration}s`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'crime-fine-multiplier') {
        const multiplier = interaction.options.getNumber('multiplier', true);
        (config as any).crimeMultiplier = multiplier;
        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Crime Fine Multiplier Updated', `**Multiplier:** ${multiplier.toFixed(2)}x`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'rob-chance') {
        const percentage = interaction.options.getInteger('percentage', true);
        (config as any).robChance = percentage;
        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Robbery Success Chance Updated', `**Chance:** ${percentage}%`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'monthly-amount') {
        const amount = interaction.options.getInteger('amount', true);
        (config as any).monthlyAmount = amount;
        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Monthly Bonus Amount Updated', `**Coins:** ${amount.toLocaleString()}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (subcommand === 'monthly-gems') {
        const amount = interaction.options.getInteger('amount', true);
        (config as any).monthlyGems = amount;
        await moduleConfig.updateConfig(guildId, 'currency', config);

        const container = successContainer('Monthly Gems Bonus Updated', `**Gems:** ${amount}`);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }
    } catch (error) {
      console.error('Error in config command:', error);
      await interaction.editReply({
        components: [errorContainer('Error', 'An error occurred while updating configuration.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
} as BotCommand;
