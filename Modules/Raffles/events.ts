import { Client, ButtonInteraction, MessageFlags, Events, ModalSubmitInteraction } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { getDb } from '../../Shared/src/database/connection';
import { raffles } from '../../Shared/src/database/models/schema';
import { eq, and, lte } from 'drizzle-orm';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  getRaffle, buyTickets, endRaffle,
  getRaffleConfig, updateRaffleMessage,
} from './helpers';
import { ActionRowBuilder, TextInputBuilder, ModalBuilder, TextInputStyle } from 'discord.js';
import { infoReply } from '../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Raffles:Events');

async function handleRaffleButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId.startsWith('raffle_buy_')) {
    const raffleId = parseInt(interaction.customId.replace('raffle_buy_', ''));
    if (isNaN(raffleId)) return;

    if (!interaction.guild) {
      await interaction.reply({ content: 'This can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const raffle = await getRaffle(raffleId);
    if (!raffle) {
      await interaction.reply({ content: 'Raffle not found.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Show modal for ticket quantity
    const modal = new ModalBuilder()
      .setCustomId(`raffle_modal_${raffleId}`)
      .setTitle('Buy Raffle Tickets');

    const ticketInput = new TextInputBuilder()
      .setCustomId('ticket_count')
      .setLabel(`Number of Tickets (1-${raffle.maxTicketsPerUser})`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(4);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(ticketInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  if (interaction.customId.startsWith('raffle_info_')) {
    const raffleId = parseInt(interaction.customId.replace('raffle_info_', ''));
    if (isNaN(raffleId)) return;

    const raffle = await getRaffle(raffleId);
    if (!raffle) {
      await interaction.reply({ content: 'Raffle not found.', flags: MessageFlags.Ephemeral });
      return;
    }

    const fields = [
      { name: 'Ticket Price', value: `${raffle.ticketPrice}`, inline: true },
      { name: 'Currency', value: raffle.currencyType, inline: true },
      { name: 'Total Participants', value: String(raffle.ticketCount), inline: true },
      { name: 'Total Tickets', value: String(raffle.totalTickets), inline: true },
      { name: 'Max Per User', value: String(raffle.maxTicketsPerUser), inline: true },
      { name: 'Winners', value: String(raffle.winnerCount), inline: true },
      { name: 'Ends', value: `<t:${Math.floor(raffle.endsAt.getTime() / 1000)}:R>`, inline: true },
    ];

    if (raffle.maxTotalTickets) {
      fields.push({ name: 'Max Total', value: String(raffle.maxTotalTickets), inline: true });
    }

    await interaction.reply({ ...infoReply(`Raffle Info - ${raffle.prize}`, fields.map(f => `**${f.name}:** ${f.value}`).join('\n')), flags: MessageFlags.Ephemeral });
    return;
  }
}

async function handleRaffleModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.customId.startsWith('raffle_modal_')) return;

  const raffleId = parseInt(interaction.customId.replace('raffle_modal_', ''));
  if (isNaN(raffleId)) return;

  if (!interaction.guild) {
    await interaction.reply({ content: 'This can only be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const ticketCountStr = interaction.fields.getTextInputValue('ticket_count');
  const ticketCount = parseInt(ticketCountStr);

  if (isNaN(ticketCount) || ticketCount <= 0) {
    await interaction.editReply({ content: 'Please enter a valid number of tickets.' });
    return;
  }

  const raffle = await getRaffle(raffleId);
  if (!raffle) {
    await interaction.editReply({ content: 'Raffle not found.' });
    return;
  }

  if (ticketCount > raffle.maxTicketsPerUser) {
    await interaction.editReply({ content: `You can only buy up to ${raffle.maxTicketsPerUser} tickets at a time.` });
    return;
  }

  const result = await buyTickets(raffleId, interaction.user.id, interaction.guild.id, ticketCount);
  if (!result.success) {
    await interaction.editReply({ content: `❌ ${result.reason}` });
    return;
  }

  // Update the raffle message
  const updatedRaffle = await getRaffle(raffleId);
  if (updatedRaffle) {
    const config = await getRaffleConfig(interaction.guild.id);
    await updateRaffleMessage(updatedRaffle, interaction.guild, config).catch(() => {
      logger.debug('Failed to update raffle message');
    });
  }

  const currencyEmoji = raffle.currencyType === 'coins' ? '🪙' : raffle.currencyType === 'gems' ? '💎' : '🎟️';
  const totalCost = raffle.ticketPrice * ticketCount;

  await interaction.editReply({
    content: `✅ Successfully bought **${ticketCount}** ticket${ticketCount !== 1 ? 's' : ''} for **${totalCost}** ${currencyEmoji}!\n\nGood luck in the raffle! 🍀`,
  });
}

async function checkExpiredRaffles(client: Client): Promise<void> {
  const db = getDb();
  try {
    const expired = await db.select().from(raffles)
      .where(and(eq(raffles.isActive, true), lte(raffles.endsAt, new Date())));

    for (const row of expired) {
      try {
        const guild = client.guilds.cache.get(row.guildId);
        if (!guild) continue;

        const raffle = await getRaffle(row.id);
        if (!raffle) continue;

        await endRaffle(raffle, guild);
        logger.info(`Auto-ended raffle ${row.id} in ${guild.name}`);
      } catch (error) {
        logger.error(`Failed to end raffle ${row.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Failed to check expired raffles:', error);
  }
}

export const raffleEvents: ModuleEvent[] = [
  {
    name: 'interactionCreate',
    event: 'interactionCreate',
    async handler(interaction: any) {
      if (interaction.isButton?.()) {
        await handleRaffleButton(interaction as ButtonInteraction);
      } else if (interaction.isModalSubmit?.()) {
        await handleRaffleModal(interaction as ModalSubmitInteraction);
      }
    },
  },
  {
    name: 'clientReady',
    event: Events.ClientReady,
    once: true,
    async handler(client: Client) {
      setInterval(() => checkExpiredRaffles(client), 30_000);
      logger.info('Raffle expiration checker started');
    },
  },
];
