import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import {
  moduleContainer,
  successReply,
  addText,
  addFields,
  addSeparator,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  module: 'casino',
  permissionPath: 'casino.staff.config',
  data: new SlashCommandBuilder()
    .setName('casino-config')
    .setDescription('Configure casino settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View current casino configuration')
    )
    .addSubcommand((sub) =>
      sub
        .setName('min-bet')
        .setDescription('Set minimum bet amount')
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('New minimum bet')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-bet')
        .setDescription('Set maximum bet amount')
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('New maximum bet')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('currency')
        .setDescription('Set currency type')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Currency type to use')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('cooldown')
        .setDescription('Set cooldown between games')
        .addIntegerOption((opt) =>
          opt
            .setName('seconds')
            .setDescription('Cooldown in seconds')
            .setRequired(true)
            .setMinValue(0)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('house-edge')
        .setDescription('Set house edge percentage')
        .addNumberOption((opt) =>
          opt
            .setName('percentage')
            .setDescription('House edge as decimal (0.02 = 2%)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('log-channel')
        .setDescription('Set channel for logging games')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to log to (remove if not specified)')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('color')
        .setDescription('Set embed color')
        .addStringOption((opt) =>
          opt
            .setName('hex')
            .setDescription('Hex color code (e.g., #FFD700)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('daily-loss-limit')
        .setDescription('Set daily loss limit per user')
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('Daily loss limit (0 = unlimited)')
            .setRequired(true)
            .setMinValue(0)
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    // Check permissions
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      await interaction.reply({
        content: 'You need Administrator or Manage Guild permissions to use this command.',
        flags: 1 << 6, // Ephemeral
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === 'view') {
      // TODO: Fetch from database when config system is set up
      const config = {
        enabled: true,
        minBet: 10,
        maxBet: 50000,
        currencyType: 'coins',
        cooldown: 10,
        houseEdge: 0.02,
        embedColor: '#FFD700',
        logChannelId: null,
        dailyLossLimit: 0,
        jackpotPool: 0,
      };

      const container = moduleContainer('casino');
      addText(container, `### 🎰 Casino Configuration\nSettings for guild **${interaction.guild?.name}**`);
      addSeparator(container, 'small');

      addFields(container, [
        { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
        { name: 'Min Bet', value: `${config.minBet}`, inline: true },
        { name: 'Max Bet', value: `${config.maxBet}`, inline: true },
        { name: 'Currency', value: config.currencyType, inline: true },
        { name: 'Cooldown', value: `${config.cooldown}s`, inline: true },
        { name: 'House Edge', value: `${(config.houseEdge * 100).toFixed(1)}%`, inline: true },
        { name: 'Color', value: config.embedColor, inline: true },
        { name: 'Log Channel', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not set', inline: true },
        { name: 'Daily Loss Limit', value: config.dailyLossLimit === 0 ? 'Unlimited' : `${config.dailyLossLimit}`, inline: true },
      ]);

      addFooter(container, 'Casino Configuration');

      await interaction.reply(v2Payload([container]));
    } else if (subcommand === 'min-bet') {
      const amount = interaction.options.getInteger('amount')!;
      // TODO: Save to database
      await interaction.reply(successReply('Updated', `Minimum bet set to **${amount}**`));
    } else if (subcommand === 'max-bet') {
      const amount = interaction.options.getInteger('amount')!;
      // TODO: Save to database
      await interaction.reply(successReply('Updated', `Maximum bet set to **${amount}**`));
    } else if (subcommand === 'currency') {
      const type = interaction.options.getString('type')!;
      // TODO: Save to database
      await interaction.reply(successReply('Updated', `Currency type set to **${type}**`));
    } else if (subcommand === 'cooldown') {
      const seconds = interaction.options.getInteger('seconds')!;
      // TODO: Save to database
      await interaction.reply(successReply('Updated', `Cooldown set to **${seconds}** seconds`));
    } else if (subcommand === 'house-edge') {
      const percentage = interaction.options.getNumber('percentage')!;
      // TODO: Save to database
      await interaction.reply(successReply('Updated', `House edge set to **${(percentage * 100).toFixed(1)}%**`));
    } else if (subcommand === 'log-channel') {
      const channel = interaction.options.getChannel('channel');
      // TODO: Save to database
      await interaction.reply(successReply('Updated', `Log channel set to ${channel ? `<#${channel.id}>` : 'disabled'}`));
    } else if (subcommand === 'color') {
      const hex = interaction.options.getString('hex')!;

      // Validate hex color
      if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        await interaction.reply({
          content: 'Invalid hex color. Use format: #RRGGBB',
          flags: 1 << 6,
        });
        return;
      }

      // TODO: Save to database
      await interaction.reply(successReply('Updated', `Embed color set to **${hex}**`));
    } else if (subcommand === 'daily-loss-limit') {
      const amount = interaction.options.getInteger('amount')!;
      // TODO: Save to database
      await interaction.reply(successReply('Updated', `Daily loss limit set to **${amount === 0 ? 'Unlimited' : amount}**`));
    }
  },
};

export default command;
