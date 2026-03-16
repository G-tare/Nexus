import {
  SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, TextChannel, Role,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

interface RaffleConfig {
  defaultChannelId?: string | null;
  ticketPrice?: number;
  currencyType?: string;
  maxTicketsPerUser?: number;
  maxActive?: number;
  dmWinners?: boolean;
  pingRoleId?: string | null;
  embedColor?: string;
  refundOnCancel?: boolean;
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('raffle-config')
    .setDescription('Configure raffle settings for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand((sub) => sub.setName('view').setDescription('View all raffle settings'))

    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Set default raffle channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Default channel for raffles')
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('ticket-price')
        .setDescription('Set default ticket price')
        .addIntegerOption((opt) =>
          opt
            .setName('price')
            .setDescription('Cost per ticket')
            .setRequired(true)
            .setMinValue(0)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('currency')
        .setDescription('Set default currency type')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Currency type')
            .setRequired(true)
            .addChoices(
              { name: 'Coins', value: 'coins' },
              { name: 'Gems', value: 'gems' },
              { name: 'Event Tokens', value: 'event_tokens' },
            )
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('max-tickets')
        .setDescription('Set max tickets per user')
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('Max tickets per user')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('max-active')
        .setDescription('Set max active raffles')
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('Max active raffles')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('dm-winners')
        .setDescription('Toggle DM winners')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Send DMs to winners')
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('ping-role')
        .setDescription('Set role to ping when raffles start')
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Role to ping (leave empty to disable)')
            .setRequired(false)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('color')
        .setDescription('Set raffle embed color')
        .addStringOption((opt) =>
          opt
            .setName('color')
            .setDescription('Hex color code (e.g., #FF6B35)')
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('refund-on-cancel')
        .setDescription('Toggle refunding on raffle cancellation')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Refund participants on cancel')
            .setRequired(true)
        )
    ),

  module: 'raffles',
  permissionPath: 'raffles.staff.config',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.' });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    try {
      const cfg = await moduleConfig.getModuleConfig(guildId, 'raffles');
      const currentConfig = (cfg?.config ?? {}) as RaffleConfig;

      if (subcommand === 'view') {
        const container = moduleContainer('raffles');
        addText(container, '### 🎟️ Raffle Configuration');
        addFields(container, [
          { name: 'Default Channel', value: currentConfig.defaultChannelId ? `<#${currentConfig.defaultChannelId}>` : 'Not set', inline: true },
          { name: 'Ticket Price', value: String(currentConfig.ticketPrice ?? 100), inline: true },
          { name: 'Currency Type', value: currentConfig.currencyType ?? 'coins', inline: true },
          { name: 'Max Tickets/User', value: String(currentConfig.maxTicketsPerUser ?? 10), inline: true },
          { name: 'Max Active Raffles', value: String(currentConfig.maxActive ?? 10), inline: true },
          { name: 'DM Winners', value: currentConfig.dmWinners ?? true ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Ping Role', value: currentConfig.pingRoleId ? `<@&${currentConfig.pingRoleId}>` : 'Not set', inline: true },
          { name: 'Embed Color', value: currentConfig.embedColor ?? '#FF6B35', inline: true },
          { name: 'Refund on Cancel', value: currentConfig.refundOnCancel ?? true ? '✅ Yes' : '❌ No', inline: true },
        ]);

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('channel', true);
        if (!(channel instanceof TextChannel)) {
          return interaction.reply({ content: '❌ Channel must be a text channel.' });
        }

        const newConfig = { ...currentConfig, defaultChannelId: channel.id };
        await moduleConfig.setConfig(guildId, 'raffles', newConfig);

        return interaction.reply({ content: `✅ Default raffle channel set to ${channel}.` });
      }

      if (subcommand === 'ticket-price') {
        const price = interaction.options.getInteger('price', true);
        const newConfig = { ...currentConfig, ticketPrice: price };
        await moduleConfig.setConfig(guildId, 'raffles', newConfig);

        return interaction.reply({ content: `✅ Default ticket price set to ${price}.` });
      }

      if (subcommand === 'currency') {
        const type = interaction.options.getString('type', true);
        const newConfig = { ...currentConfig, currencyType: type };
        await moduleConfig.setConfig(guildId, 'raffles', newConfig);

        return interaction.reply({ content: `✅ Default currency type set to ${type}.` });
      }

      if (subcommand === 'max-tickets') {
        const amount = interaction.options.getInteger('amount', true);
        const newConfig = { ...currentConfig, maxTicketsPerUser: amount };
        await moduleConfig.setConfig(guildId, 'raffles', newConfig);

        return interaction.reply({ content: `✅ Max tickets per user set to ${amount}.` });
      }

      if (subcommand === 'max-active') {
        const amount = interaction.options.getInteger('amount', true);
        const newConfig = { ...currentConfig, maxActive: amount };
        await moduleConfig.setConfig(guildId, 'raffles', newConfig);

        return interaction.reply({ content: `✅ Max active raffles set to ${amount}.` });
      }

      if (subcommand === 'dm-winners') {
        const enabled = interaction.options.getBoolean('enabled', true);
        const newConfig = { ...currentConfig, dmWinners: enabled };
        await moduleConfig.setConfig(guildId, 'raffles', newConfig);

        return interaction.reply({ content: `✅ DM winners setting updated to ${enabled ? 'enabled' : 'disabled'}.` });
      }

      if (subcommand === 'ping-role') {
        const role = interaction.options.getRole('role');
        const newConfig = { ...currentConfig, pingRoleId: role?.id ?? null };
        await moduleConfig.setConfig(guildId, 'raffles', newConfig);

        if (role) {
          return interaction.reply({ content: `✅ Ping role set to ${role}.` });
        } else {
          return interaction.reply({ content: '✅ Ping role disabled.' });
        }
      }

      if (subcommand === 'color') {
        const color = interaction.options.getString('color', true);
        if (!/^#[0-9A-F]{6}$/i.test(color)) {
          return interaction.reply({ content: '❌ Invalid color format. Use hex format like #FF6B35.' });
        }

        const newConfig = { ...currentConfig, embedColor: color };
        await moduleConfig.setConfig(guildId, 'raffles', newConfig);

        return interaction.reply({ content: `✅ Embed color set to ${color}.` });
      }

      if (subcommand === 'refund-on-cancel') {
        const enabled = interaction.options.getBoolean('enabled', true);
        const newConfig = { ...currentConfig, refundOnCancel: enabled };
        await moduleConfig.setConfig(guildId, 'raffles', newConfig);

        return interaction.reply({ content: `✅ Refund on cancel setting updated to ${enabled ? 'enabled' : 'disabled'}.` });
      }
    } catch (error) {
      console.error('Error in raffle config:', error);
      return interaction.reply({ content: 'An error occurred while updating the configuration.' });
    }
  },
} as BotCommand;

export default command;
