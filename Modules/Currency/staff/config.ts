import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
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

        const embed = successEmbed(`Currency Name Updated`)
          .addFields(
            { name: 'Type', value: type, inline: true },
            { name: 'Name', value: name, inline: true },
            { name: 'Emoji', value: emoji, inline: true }
          );

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'daily') {
        const type = interaction.options.getString('type', true) as CurrencyType;
        const amount = interaction.options.getInteger('amount', true);

        config.currencies[type].dailyAmount = amount;

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const embed = successEmbed(`Daily Reward Updated`)
          .addFields(
            { name: 'Type', value: type, inline: true },
            { name: 'New Daily Amount', value: amount.toString(), inline: true }
          );

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'weekly') {
        const type = interaction.options.getString('type', true) as CurrencyType;
        const amount = interaction.options.getInteger('amount', true);

        config.currencies[type].weeklyAmount = amount;

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const embed = successEmbed(`Weekly Reward Updated`)
          .addFields(
            { name: 'Type', value: type, inline: true },
            { name: 'New Weekly Amount', value: amount.toString(), inline: true }
          );

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'send-cap') {
        const amount = interaction.options.getInteger('amount', true);

        config.sendCap = amount;

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const embed = successEmbed(`Send Cap Updated`)
          .addFields({ name: 'New Send Cap', value: amount.toString(), inline: true });

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'receive-cap') {
        const amount = interaction.options.getInteger('amount', true);

        config.receiveCap = amount;

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const embed = successEmbed(`Receive Cap Updated`)
          .addFields({ name: 'New Receive Cap', value: amount.toString(), inline: true });

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'tax') {
        const percentage = interaction.options.getInteger('percentage', true);

        config.taxPercent = percentage;

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const embed = successEmbed(`Tax Updated`)
          .addFields({ name: 'New Tax', value: `${percentage}%`, inline: true });

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'message-earn') {
        const type = interaction.options.getString('type', true) as CurrencyType;
        const amount = interaction.options.getInteger('amount', true);
        const cooldown = interaction.options.getInteger('cooldown', true);

        config.messageEarn = { type, amount, cooldownSeconds: cooldown };

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const embed = successEmbed(`Message Earn Updated`)
          .addFields(
            { name: 'Type', value: type, inline: true },
            { name: 'Amount Per Message', value: amount.toString(), inline: true },
            { name: 'Cooldown', value: `${cooldown}s`, inline: true }
          );

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'voice-earn') {
        const type = interaction.options.getString('type', true) as CurrencyType;
        const amount = interaction.options.getInteger('amount', true);

        config.voiceEarn = { type, amountPerMinute: amount };

        await moduleConfig.updateConfig(guildId, 'currency', config);

        const embed = successEmbed(`Voice Earn Updated`)
          .addFields(
            { name: 'Type', value: type, inline: true },
            { name: 'Amount Per Minute', value: amount.toString(), inline: true }
          );

        return interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error in config command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while updating configuration.')],
      });
    }
  },
} as BotCommand;
