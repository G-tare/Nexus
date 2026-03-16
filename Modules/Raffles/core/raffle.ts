import {
  SlashCommandBuilder, ChannelType, TextChannel,
  ChatInputCommandInteraction, MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { parseDuration } from '../../../Shared/src/utils/time';
import { createRaffle, getActiveRaffles, getRaffleConfig, buildRaffleContainer, buildRaffleComponents } from '../helpers';
import { getDb } from '../../../Shared/src/database/connection';
import { raffles } from '../../../Shared/src/database/models/schema';
import { eq } from 'drizzle-orm';
import { v2Payload, addButtons } from '../../../Shared/src/utils/componentsV2';

export default {
  data: new SlashCommandBuilder()
    .setName('raffle')
    .setDescription('Start a new ticket-based raffle')
    .addStringOption((option) => option.setName('prize').setDescription('The prize for the raffle').setRequired(true).setMaxLength(256))
    .addStringOption((option) => option.setName('duration').setDescription('How long the raffle lasts (e.g., 1h, 2d, 30m)').setRequired(true))
    .addIntegerOption((option) => option.setName('ticket-price').setDescription('Cost per ticket (default: from config)').setMinValue(0))
    .addIntegerOption((option) => option.setName('winners').setDescription('Number of winners (default: 1)').setMinValue(1).setMaxValue(20))
    .addChannelOption((option) => option.setName('channel').setDescription('Channel to send raffle to').addChannelTypes(ChannelType.GuildText))
    .addStringOption((option) => option.setName('description').setDescription('Additional description').setMaxLength(1000))
    .addIntegerOption((option) => option.setName('max-tickets-per-user').setDescription('Max tickets per user (default: from config)').setMinValue(1).setMaxValue(100))
    .addIntegerOption((option) => option.setName('max-total-tickets').setDescription('Max total tickets available').setMinValue(1))
    .addStringOption((option) =>
      option.setName('currency')
        .setDescription('Currency type')
        .addChoices(
          { name: 'Coins', value: 'coins' },
          { name: 'Gems', value: 'gems' },
          { name: 'Event Tokens', value: 'event_tokens' },
        )
    ),

  module: 'raffles',
  permissionPath: 'raffles.raffle',
  premiumFeature: 'raffles.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    const prize = interaction.options.getString('prize', true);
    const durationStr = interaction.options.getString('duration', true);
    const winnerCount = interaction.options.getInteger('winners') ?? 1;
    const targetChannel = interaction.options.getChannel('channel') ?? interaction.channel;
    const description = interaction.options.getString('description');
    const customTicketPrice = interaction.options.getInteger('ticket-price');
    const customMaxTickets = interaction.options.getInteger('max-tickets-per-user');
    const maxTotalTickets = interaction.options.getInteger('max-total-tickets');
    const customCurrency = interaction.options.getString('currency');

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.reply({ content: 'Invalid duration format. Use formats like: 1h, 2d, 30m', flags: MessageFlags.Ephemeral });
    }

    const endTime = new Date(Date.now() + durationMs);

    if (!targetChannel || !(targetChannel instanceof TextChannel)) {
      return interaction.reply({ content: 'Target channel must be a text channel.', flags: MessageFlags.Ephemeral });
    }

    // Get config and check limits
    const config = await getRaffleConfig(interaction.guild.id);
    const activeRaffles = await getActiveRaffles(interaction.guild.id);

    if (activeRaffles.length >= config.maxActive) {
      return interaction.reply({
        content: `Maximum of ${config.maxActive} active raffles reached. End or cancel some first.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const db = getDb();
    const ticketPrice = customTicketPrice ?? config.ticketPrice;
    const maxTicketsPerUser = customMaxTickets ?? config.maxTicketsPerUser;
    const currencyType = (customCurrency as any) ?? config.currencyType;

    try {
      const raffle = await createRaffle({
        guildId: interaction.guild.id,
        channelId: targetChannel.id,
        hostId: interaction.user.id,
        prize,
        description: description || undefined,
        winnerCount,
        ticketPrice,
        currencyType,
        maxTicketsPerUser,
        maxTotalTickets: maxTotalTickets || undefined,
        endsAt: endTime,
      });

      const container = buildRaffleContainer(raffle, config);
      const actionRows = buildRaffleComponents(raffle);
      addButtons(container, actionRows[0].components as any);

      const message = await (targetChannel as any).send(v2Payload([container]));

      // Update message ID in database
      await db.update(raffles).set({ messageId: message.id }).where(eq(raffles.id, raffle.id));

      // Send ping message if configured
      if (config.pingRoleId) {
        try {
          const role = await interaction.guild.roles.fetch(config.pingRoleId);
          if (role) {
            await (targetChannel as any).send({
              content: `${role} A new raffle has started!`,
              allowedMentions: { roles: [config.pingRoleId] },
            });
          }
        } catch (error) {
          // Silently fail if role doesn't exist
        }
      }

      return interaction.reply({ content: `✅ Raffle created! [View here](${message.url})`, flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error('Error creating raffle:', error);
      return interaction.reply({ content: 'An error occurred while creating the raffle.', flags: MessageFlags.Ephemeral });
    }
  },
} as BotCommand;
