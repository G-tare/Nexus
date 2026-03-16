import {
  Guild, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  TextChannel, ContainerBuilder,
} from 'discord.js';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { getDb } from '../../Shared/src/database/connection';
import { raffles, raffleEntries, guildMembers } from '../../Shared/src/database/models/schema';
import { eq, and, sql, desc, lte } from 'drizzle-orm';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { getBalance, removeCurrency, addCurrency, getCurrencyConfig, CurrencyType } from '../Currency/helpers';
import {
  moduleContainer, addText, addFields, addSeparator, addFooter, addButtons,
  v2Payload, successContainer, errorContainer
} from '../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Raffles');

// ============================================================================
// INTERFACES
// ============================================================================

export interface RaffleConfig {
  defaultChannelId: string | null;
  ticketPrice: number;
  currencyType: CurrencyType;
  maxTicketsPerUser: number;
  maxActive: number;
  dmWinners: boolean;
  pingRoleId: string | null;
  embedColor: string;
  refundOnCancel: boolean;
}

export interface RaffleData {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string | null;
  hostId: string;
  prize: string;
  description: string | null;
  winnerCount: number;
  ticketPrice: number;
  currencyType: CurrencyType;
  maxTicketsPerUser: number;
  maxTotalTickets: number | null;
  isActive: boolean;
  startsAt: Date;
  endsAt: Date;
  endedAt: Date | null;
  winners: string[];
  ticketCount: number;
  totalTickets: number;
}

// ============================================================================
// CONFIGURATION HELPERS
// ============================================================================

export async function getRaffleConfig(guildId: string): Promise<RaffleConfig> {
  try {
    const cfg = await moduleConfig.getModuleConfig(guildId, 'raffles');
    const config = (cfg?.config ?? {}) as Record<string, any>;
    return {
      defaultChannelId: config.defaultChannelId ?? null,
      ticketPrice: config.ticketPrice ?? 100,
      currencyType: config.currencyType ?? 'coins',
      maxTicketsPerUser: config.maxTicketsPerUser ?? 10,
      maxActive: config.maxActive ?? 10,
      dmWinners: config.dmWinners ?? true,
      pingRoleId: config.pingRoleId ?? null,
      embedColor: config.embedColor ?? '#FF6B35',
      refundOnCancel: config.refundOnCancel ?? true,
    };
  } catch (error) {
    logger.error(`Failed to get raffle config for guild ${guildId}:`, error);
    return {
      defaultChannelId: null,
      ticketPrice: 100,
      currencyType: 'coins',
      maxTicketsPerUser: 10,
      maxActive: 10,
      dmWinners: true,
      pingRoleId: null,
      embedColor: '#FF6B35',
      refundOnCancel: true,
    };
  }
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

export async function createRaffle(data: {
  guildId: string;
  channelId: string;
  hostId: string;
  prize: string;
  description?: string;
  winnerCount?: number;
  ticketPrice?: number;
  currencyType?: CurrencyType;
  maxTicketsPerUser?: number;
  maxTotalTickets?: number;
  endsAt: Date;
}): Promise<RaffleData> {
  const db = getDb();
  const rows = await db.insert(raffles).values({
    guildId: data.guildId,
    channelId: data.channelId,
    hostId: data.hostId,
    prize: data.prize,
    description: data.description || null,
    winnerCount: data.winnerCount || 1,
    ticketPrice: data.ticketPrice || 0,
    currencyType: data.currencyType || 'coins',
    maxTicketsPerUser: data.maxTicketsPerUser || 10,
    maxTotalTickets: data.maxTotalTickets || null,
    isActive: true,
    endsAt: data.endsAt,
  }).returning();

  const row = rows[0];
  return {
    id: row.id,
    guildId: row.guildId,
    channelId: row.channelId,
    messageId: row.messageId,
    hostId: row.hostId,
    prize: row.prize,
    description: row.description,
    winnerCount: row.winnerCount,
    ticketPrice: row.ticketPrice,
    currencyType: row.currencyType as CurrencyType,
    maxTicketsPerUser: row.maxTicketsPerUser,
    maxTotalTickets: row.maxTotalTickets,
    isActive: row.isActive,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    endedAt: row.endedAt,
    winners: (row.winners as string[]) || [],
    ticketCount: 0,
    totalTickets: 0,
  };
}

export async function getRaffle(raffleId: number): Promise<RaffleData | null> {
  const db = getDb();
  const result = await db.select().from(raffles).where(eq(raffles.id, raffleId)).limit(1);
  if (!result.length) return null;

  const row = result[0];
  const ticketInfo = await getTicketInfo(raffleId);

  return {
    id: row.id,
    guildId: row.guildId,
    channelId: row.channelId,
    messageId: row.messageId,
    hostId: row.hostId,
    prize: row.prize,
    description: row.description,
    winnerCount: row.winnerCount,
    ticketPrice: row.ticketPrice,
    currencyType: row.currencyType as CurrencyType,
    maxTicketsPerUser: row.maxTicketsPerUser,
    maxTotalTickets: row.maxTotalTickets,
    isActive: row.isActive,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    endedAt: row.endedAt,
    winners: (row.winners as string[]) || [],
    ticketCount: ticketInfo.uniqueParticipants,
    totalTickets: ticketInfo.totalTickets,
  };
}

export async function getActiveRaffles(guildId: string): Promise<RaffleData[]> {
  const db = getDb();
  const results = await db.select().from(raffles)
    .where(and(eq(raffles.guildId, guildId), eq(raffles.isActive, true)))
    .orderBy(desc(raffles.startsAt));

  const raffleDataArray: RaffleData[] = [];
  for (const row of results) {
    const ticketInfo = await getTicketInfo(row.id);
    raffleDataArray.push({
      id: row.id,
      guildId: row.guildId,
      channelId: row.channelId,
      messageId: row.messageId,
      hostId: row.hostId,
      prize: row.prize,
      description: row.description,
      winnerCount: row.winnerCount,
      ticketPrice: row.ticketPrice,
      currencyType: row.currencyType as CurrencyType,
      maxTicketsPerUser: row.maxTicketsPerUser,
      maxTotalTickets: row.maxTotalTickets,
      isActive: row.isActive,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      endedAt: row.endedAt,
      winners: (row.winners as string[]) || [],
      ticketCount: ticketInfo.uniqueParticipants,
      totalTickets: ticketInfo.totalTickets,
    });
  }

  return raffleDataArray;
}

export async function getTicketInfo(raffleId: number): Promise<{ uniqueParticipants: number; totalTickets: number }> {
  const db = getDb();
  const result = await db.select({
    uniqueParticipants: sql<number>`COUNT(DISTINCT ${raffleEntries.userId})`,
    totalTickets: sql<number>`COALESCE(SUM(${raffleEntries.tickets}), 0)`,
  }).from(raffleEntries).where(eq(raffleEntries.raffleId, raffleId));

  return {
    uniqueParticipants: result[0]?.uniqueParticipants || 0,
    totalTickets: result[0]?.totalTickets || 0,
  };
}

export async function getUserTickets(raffleId: number, userId: string): Promise<number> {
  const db = getDb();
  const result = await db.select({ tickets: raffleEntries.tickets }).from(raffleEntries)
    .where(and(eq(raffleEntries.raffleId, raffleId), eq(raffleEntries.userId, userId)))
    .limit(1);

  return result[0]?.tickets || 0;
}

export async function buyTickets(
  raffleId: number,
  userId: string,
  guildId: string,
  count: number,
): Promise<{ success: boolean; reason?: string }> {
  const db = getDb();
  const raffle = await getRaffle(raffleId);

  if (!raffle) {
    return { success: false, reason: 'Raffle not found.' };
  }

  if (!raffle.isActive) {
    return { success: false, reason: 'This raffle is no longer active.' };
  }

  if (raffle.endsAt < new Date()) {
    return { success: false, reason: 'This raffle has ended.' };
  }

  if (count <= 0 || count > raffle.maxTicketsPerUser) {
    return { success: false, reason: `You can buy 1-${raffle.maxTicketsPerUser} tickets at a time.` };
  }

  const currentTickets = await getUserTickets(raffleId, userId);
  if (currentTickets + count > raffle.maxTicketsPerUser) {
    return {
      success: false,
      reason: `You can only have ${raffle.maxTicketsPerUser} tickets total. You currently have ${currentTickets}.`,
    };
  }

  // Check max total tickets
  if (raffle.maxTotalTickets && raffle.totalTickets + count > raffle.maxTotalTickets) {
    return {
      success: false,
      reason: `Not enough tickets available. Only ${raffle.maxTotalTickets - raffle.totalTickets} tickets remain.`,
    };
  }

  const totalCost = raffle.ticketPrice * count;

  // Check currency balance
  const balance = await getBalance(guildId, userId);
  const currentBalance = raffle.currencyType === 'coins' ? balance.coins :
    raffle.currencyType === 'gems' ? balance.gems : balance.eventTokens;

  if (currentBalance < totalCost) {
    return {
      success: false,
      reason: `You don't have enough currency. You need ${totalCost} but only have ${currentBalance}.`,
    };
  }

  // Deduct currency
  const removeResult = await removeCurrency(guildId, userId, raffle.currencyType, totalCost, 'raffle_entry', { raffleId });
  if (!removeResult.success) {
    return { success: false, reason: 'Failed to deduct currency.' };
  }

  // Update or insert entry
  const existing = await db.select().from(raffleEntries)
    .where(and(eq(raffleEntries.raffleId, raffleId), eq(raffleEntries.userId, userId)))
    .limit(1);

  if (existing.length) {
    await db.update(raffleEntries).set({
      tickets: existing[0].tickets + count,
      totalSpent: existing[0].totalSpent + totalCost,
    }).where(and(eq(raffleEntries.raffleId, raffleId), eq(raffleEntries.userId, userId)));
  } else {
    await db.insert(raffleEntries).values({
      raffleId,
      userId,
      tickets: count,
      totalSpent: totalCost,
    });
  }

  return { success: true };
}

export async function pickWinners(raffleId: number, winnerCount: number): Promise<string[]> {
  const db = getDb();

  // Get all entries with their ticket counts
  const entries = await db.select({
    userId: raffleEntries.userId,
    tickets: raffleEntries.tickets,
  }).from(raffleEntries).where(eq(raffleEntries.raffleId, raffleId));

  if (entries.length === 0) return [];

  // Weighted random selection
  const winners: string[] = [];
  const entriesCopy = [...entries];

  for (let i = 0; i < Math.min(winnerCount, entries.length); i++) {
    const totalTickets = entriesCopy.reduce((sum, entry) => sum + entry.tickets, 0);
    if (totalTickets === 0) break;

    let random = Math.random() * totalTickets;
    let selected = -1;

    for (let j = 0; j < entriesCopy.length; j++) {
      random -= entriesCopy[j].tickets;
      if (random <= 0) {
        selected = j;
        break;
      }
    }

    if (selected !== -1) {
      winners.push(entriesCopy[selected].userId);
      entriesCopy.splice(selected, 1);
    }
  }

  return [...new Set(winners)]; // Remove duplicates
}

export async function endRaffle(raffle: RaffleData, guild: Guild): Promise<string[]> {
  const db = getDb();
  const winners = await pickWinners(raffle.id, raffle.winnerCount);

  // Update raffle with winners
  await db.update(raffles).set({
    isActive: false,
    endedAt: new Date(),
    winners: winners as any,
  }).where(eq(raffles.id, raffle.id));

  // DM winners
  const config = await getRaffleConfig(guild.id);
  if (config.dmWinners && winners.length > 0) {
    for (const winnerId of winners) {
      try {
        const user = await guild.client.users.fetch(winnerId);
        const container = successContainer(
          'You Won!',
          `Congratulations! You won **${raffle.prize}** in a raffle on **${guild.name}**!`
        );
        await user.send(v2Payload([container])).catch(() => {
          logger.debug(`Could not DM winner ${winnerId}`);
        });
      } catch (error) {
        logger.debug(`Failed to fetch user ${winnerId}:`, error);
      }
    }
  }

  // Update message
  if (raffle.messageId) {
    try {
      const channel = await guild.channels.fetch(raffle.channelId) as TextChannel;
      const message = await channel?.messages.fetch(raffle.messageId);
      if (message) {
        const container = buildRaffleEndedContainer(raffle, winners);
        await message.edit(v2Payload([container]));
      }
    } catch (error) {
      logger.debug(`Failed to update raffle message:`, error);
    }
  }

  return winners;
}

export async function cancelRaffle(raffle: RaffleData, guild: Guild): Promise<void> {
  const db = getDb();
  const config = await getRaffleConfig(guild.id);

  // Refund all participants
  if (config.refundOnCancel) {
    const entries = await db.select().from(raffleEntries).where(eq(raffleEntries.raffleId, raffle.id));

    for (const entry of entries) {
      await addCurrency(guild.id, entry.userId, raffle.currencyType, entry.totalSpent, 'raffle_refund', { raffleId: raffle.id }).catch(() => {
        logger.debug(`Failed to refund user ${entry.userId}`);
      });
    }
  }

  // Update raffle
  await db.update(raffles).set({
    isActive: false,
    endedAt: new Date(),
    winners: [],
  }).where(eq(raffles.id, raffle.id));

  // Update message
  if (raffle.messageId) {
    try {
      const channel = await guild.channels.fetch(raffle.channelId) as TextChannel;
      const message = await channel?.messages.fetch(raffle.messageId);
      if (message) {
        const container = errorContainer(
          'Raffle Cancelled',
          `The raffle for **${raffle.prize}** has been cancelled.${config.refundOnCancel ? '\n\nAll participants have been refunded.' : ''}`
        );
        await message.edit(v2Payload([container]));
      }
    } catch (error) {
      logger.debug(`Failed to update raffle message:`, error);
    }
  }

  // Delete entries
  await db.delete(raffleEntries).where(eq(raffleEntries.raffleId, raffle.id));
}

// ============================================================================
// EMBED & COMPONENT BUILDERS
// ============================================================================

export function buildRaffleContainer(raffle: RaffleData, config: RaffleConfig): ContainerBuilder {
  const timeRemaining = raffle.endsAt.getTime() - Date.now();
  const isExpired = timeRemaining <= 0;

  const container = moduleContainer('raffles');

  const title = isExpired ? '❌ Raffle Ended' : `🎟️ ${raffle.prize}`;
  addText(container, `### ${title}`);

  if (raffle.description) {
    addText(container, raffle.description);
    addSeparator(container, 'small');
  }

  const fields = [
    { name: 'Ticket Price', value: `${raffle.ticketPrice} ${raffle.currencyType === 'coins' ? '🪙' : raffle.currencyType === 'gems' ? '💎' : '🎟️'}`, inline: true },
    { name: 'Participants', value: String(raffle.ticketCount), inline: true },
    { name: 'Total Tickets', value: String(raffle.totalTickets), inline: true },
    { name: 'Winners', value: String(raffle.winnerCount), inline: true },
    { name: 'Max per User', value: String(raffle.maxTicketsPerUser), inline: true },
    { name: 'Ends', value: `<t:${Math.floor(raffle.endsAt.getTime() / 1000)}:R>`, inline: true },
  ];

  if (raffle.maxTotalTickets) {
    fields.push({ name: 'Max Total Tickets', value: String(raffle.maxTotalTickets), inline: true });
  }

  addFields(container, fields);

  return container;
}

export function buildRaffleEndedContainer(raffle: RaffleData, winners: string[]): ContainerBuilder {
  const container = moduleContainer('raffles');

  addText(container, `### 🎉 Raffle Ended - ${raffle.prize}`);
  addSeparator(container, 'small');

  const fields = [
    { name: 'Total Participants', value: String(raffle.ticketCount), inline: true },
    { name: 'Total Tickets Sold', value: String(raffle.totalTickets), inline: true },
    { name: 'Winners', value: winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'No winners.', inline: false },
  ];

  addFields(container, fields);

  return container;
}

export function buildRaffleComponents(raffle: RaffleData): ActionRowBuilder<ButtonBuilder>[] {
  const buyButton = new ButtonBuilder()
    .setCustomId(`raffle_buy_${raffle.id}`)
    .setLabel('🎟️ Buy Ticket')
    .setStyle(ButtonStyle.Primary);

  const ticketDisplay = new ButtonBuilder()
    .setCustomId(`raffle_info_${raffle.id}`)
    .setLabel(`${raffle.totalTickets} 🎟️`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(buyButton, ticketDisplay),
  ];
}

export async function updateRaffleMessage(raffle: RaffleData, guild: Guild, config: RaffleConfig): Promise<void> {
  if (!raffle.messageId) return;

  try {
    const channel = await guild.channels.fetch(raffle.channelId) as TextChannel;
    const message = await channel?.messages.fetch(raffle.messageId);
    if (message) {
      const container = buildRaffleContainer(raffle, config);
      const components = buildRaffleComponents(raffle);
      addButtons(container, components[0].components as ButtonBuilder[]);
      await message.edit(v2Payload([container]));
    }
  } catch (error) {
    logger.debug(`Failed to update raffle message:`, error);
  }
}
