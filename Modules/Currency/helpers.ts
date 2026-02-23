import { getDb } from '../../Shared/src/database/connection';
import { getRedis } from '../../Shared/src/database/connection';
import { guildMembers, transactions } from '../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { EmbedBuilder } from 'discord.js';
import { Colors } from '../../Shared/src/utils/embed';

const logger = createModuleLogger('Currency');

// ============================================
// Currency Config Interface
// ============================================

export interface CurrencyInfo {
  name: string;
  emoji: string;
  dailyAmount: number;
  weeklyAmount: number;
}

export interface CurrencyConfig {
  currencies: {
    coins: CurrencyInfo;
    gems: CurrencyInfo;
    event_tokens: CurrencyInfo;
  };
  sendCap: number;
  receiveCap: number;
  taxPercent: number;
  messageEarn: { type: string; amount: number; cooldownSeconds: number };
  voiceEarn: { type: string; amountPerMinute: number };
  streakBonusMultiplier: number;
  streakMaxMultiplier: number;
  levelUpBonus: { coins: number; gems: number };
  birthdayBonus: { coins: number; gems: number };
}

export const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  currencies: {
    coins: { name: 'Coins', emoji: '🪙', dailyAmount: 100, weeklyAmount: 500 },
    gems: { name: 'Gems', emoji: '💎', dailyAmount: 5, weeklyAmount: 25 },
    event_tokens: { name: 'Event Tokens', emoji: '🎟️', dailyAmount: 0, weeklyAmount: 0 },
  },
  sendCap: 5000,
  receiveCap: 10000,
  taxPercent: 0,
  messageEarn: { type: 'coins', amount: 5, cooldownSeconds: 60 },
  voiceEarn: { type: 'coins', amountPerMinute: 2 },
  streakBonusMultiplier: 0.1,
  streakMaxMultiplier: 2.0,
  levelUpBonus: { coins: 50, gems: 1 },
  birthdayBonus: { coins: 500, gems: 10 },
};

// ============================================
// Get Config
// ============================================

export async function getCurrencyConfig(guildId: string): Promise<CurrencyConfig> {
  const cfg = await moduleConfig.getModuleConfig<CurrencyConfig>(guildId, 'currency');
  return { ...DEFAULT_CURRENCY_CONFIG, ...(cfg?.config || {}) };
}

// ============================================
// Currency Column Mapping
// ============================================

export type CurrencyType = 'coins' | 'gems' | 'event_tokens';

export function getCurrencyColumn(type: CurrencyType): 'coins' | 'gems' | 'eventTokens' {
  switch (type) {
    case 'coins': return 'coins';
    case 'gems': return 'gems';
    case 'event_tokens': return 'eventTokens';
    default: return 'coins';
  }
}

export function getCurrencyDbColumn(type: CurrencyType): string {
  switch (type) {
    case 'coins': return 'coins';
    case 'gems': return 'gems';
    case 'event_tokens': return 'event_tokens';
    default: return 'coins';
  }
}

// ============================================
// Ensure Member Exists
// ============================================

export async function ensureMember(guildId: string, userId: string): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    INSERT INTO users (id, created_at, updated_at) VALUES (${userId}, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO guild_members (guild_id, user_id) VALUES (${guildId}, ${userId})
    ON CONFLICT (guild_id, user_id) DO NOTHING
  `);
}

// ============================================
// Get Balance
// ============================================

export async function getBalance(guildId: string, userId: string): Promise<{
  coins: number; gems: number; eventTokens: number;
}> {
  await ensureMember(guildId, userId);
  const db = getDb();
  const [member] = await db.select({
    coins: guildMembers.coins,
    gems: guildMembers.gems,
    eventTokens: guildMembers.eventTokens,
  })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
    .limit(1);

  return {
    coins: Number(member?.coins ?? 0),
    gems: Number(member?.gems ?? 0),
    eventTokens: Number(member?.eventTokens ?? 0),
  };
}

// ============================================
// Add Currency
// ============================================

export async function addCurrency(
  guildId: string,
  userId: string,
  type: CurrencyType,
  amount: number,
  source: string,
  metadata?: Record<string, any>
): Promise<number> {
  if (amount <= 0) return 0;
  await ensureMember(guildId, userId);

  const db = getDb();
  const col = getCurrencyDbColumn(type);

  // Update balance
  await db.execute(sql`
    UPDATE guild_members
    SET ${sql.raw(col)} = ${sql.raw(col)} + ${amount}
    WHERE guild_id = ${guildId} AND user_id = ${userId}
  `);

  // Get new balance
  const balance = await getBalance(guildId, userId);
  const newBalance = type === 'coins' ? balance.coins : type === 'gems' ? balance.gems : balance.eventTokens;

  // Log transaction
  await db.insert(transactions).values({
    guildId,
    userId,
    type: 'earn',
    currencyType: type,
    amount,
    balance: newBalance,
    source,
    metadata: metadata || {},
  });

  logger.debug('Currency added', { guildId, userId, type, amount, source, newBalance });
  return newBalance;
}

// ============================================
// Remove Currency
// ============================================

export async function removeCurrency(
  guildId: string,
  userId: string,
  type: CurrencyType,
  amount: number,
  source: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; newBalance: number }> {
  if (amount <= 0) return { success: false, newBalance: 0 };
  await ensureMember(guildId, userId);

  const db = getDb();
  const col = getCurrencyDbColumn(type);

  // Check current balance
  const balance = await getBalance(guildId, userId);
  const currentBalance = type === 'coins' ? balance.coins : type === 'gems' ? balance.gems : balance.eventTokens;

  if (currentBalance < amount) {
    return { success: false, newBalance: currentBalance };
  }

  // Update balance
  await db.execute(sql`
    UPDATE guild_members
    SET ${sql.raw(col)} = ${sql.raw(col)} - ${amount}
    WHERE guild_id = ${guildId} AND user_id = ${userId}
  `);

  const newBalance = currentBalance - amount;

  // Log transaction
  await db.insert(transactions).values({
    guildId,
    userId,
    type: 'spend',
    currencyType: type,
    amount: -amount,
    balance: newBalance,
    source,
    metadata: metadata || {},
  });

  return { success: true, newBalance };
}

// ============================================
// Set Currency (exact amount)
// ============================================

export async function setCurrency(
  guildId: string,
  userId: string,
  type: CurrencyType,
  amount: number,
  source: string
): Promise<number> {
  await ensureMember(guildId, userId);

  const db = getDb();
  const col = getCurrencyDbColumn(type);

  await db.execute(sql`
    UPDATE guild_members
    SET ${sql.raw(col)} = ${amount}
    WHERE guild_id = ${guildId} AND user_id = ${userId}
  `);

  // Log transaction
  await db.insert(transactions).values({
    guildId,
    userId,
    type: 'admin_set',
    currencyType: type,
    amount,
    balance: amount,
    source,
  });

  return amount;
}

// ============================================
// Transfer Currency
// ============================================

export async function transferCurrency(
  guildId: string,
  fromUserId: string,
  toUserId: string,
  type: CurrencyType,
  amount: number,
  config: CurrencyConfig
): Promise<{ success: boolean; error?: string; tax: number; netAmount: number }> {
  if (amount <= 0) return { success: false, error: 'Amount must be positive.', tax: 0, netAmount: 0 };
  if (fromUserId === toUserId) return { success: false, error: "You can't pay yourself.", tax: 0, netAmount: 0 };

  // Check daily send cap
  const sentToday = await getDailyTransferAmount(guildId, fromUserId, 'out');
  if (sentToday + amount > config.sendCap) {
    return {
      success: false,
      error: `You've hit your daily send cap. You can send ${Math.max(0, config.sendCap - sentToday)} more today.`,
      tax: 0,
      netAmount: 0,
    };
  }

  // Check daily receive cap
  const receivedToday = await getDailyTransferAmount(guildId, toUserId, 'in');
  const tax = Math.floor(amount * (config.taxPercent / 100));
  const netAmount = amount - tax;

  if (receivedToday + netAmount > config.receiveCap) {
    return {
      success: false,
      error: 'That user has reached their daily receive cap.',
      tax: 0,
      netAmount: 0,
    };
  }

  // Check sender balance
  const senderBalance = await getBalance(guildId, fromUserId);
  const currentBalance = type === 'coins' ? senderBalance.coins : type === 'gems' ? senderBalance.gems : senderBalance.eventTokens;
  if (currentBalance < amount) {
    const currencyName = config.currencies[type]?.name || type;
    return {
      success: false,
      error: `You don't have enough ${currencyName}. You have ${currentBalance}.`,
      tax: 0,
      netAmount: 0,
    };
  }

  // Execute transfer
  const db = getDb();
  const col = getCurrencyDbColumn(type);

  // Deduct from sender (full amount)
  await db.execute(sql`
    UPDATE guild_members SET ${sql.raw(col)} = ${sql.raw(col)} - ${amount}
    WHERE guild_id = ${guildId} AND user_id = ${fromUserId}
  `);

  // Add to receiver (net after tax)
  await ensureMember(guildId, toUserId);
  await db.execute(sql`
    UPDATE guild_members SET ${sql.raw(col)} = ${sql.raw(col)} + ${netAmount}
    WHERE guild_id = ${guildId} AND user_id = ${toUserId}
  `);

  // Get new balances
  const newSenderBalance = await getBalance(guildId, fromUserId);
  const newReceiverBalance = await getBalance(guildId, toUserId);

  const senderNew = type === 'coins' ? newSenderBalance.coins : type === 'gems' ? newSenderBalance.gems : newSenderBalance.eventTokens;
  const receiverNew = type === 'coins' ? newReceiverBalance.coins : type === 'gems' ? newReceiverBalance.gems : newReceiverBalance.eventTokens;

  // Log transactions
  await db.insert(transactions).values([
    {
      guildId,
      userId: fromUserId,
      type: 'transfer_out',
      currencyType: type,
      amount: -amount,
      balance: senderNew,
      source: 'transfer',
      metadata: { toUserId, tax, netAmount },
    },
    {
      guildId,
      userId: toUserId,
      type: 'transfer_in',
      currencyType: type,
      amount: netAmount,
      balance: receiverNew,
      source: 'transfer',
      metadata: { fromUserId, tax, grossAmount: amount },
    },
  ]);

  return { success: true, tax, netAmount };
}

// ============================================
// Daily Transfer Tracking
// ============================================

async function getDailyTransferAmount(
  guildId: string,
  userId: string,
  direction: 'in' | 'out'
): Promise<number> {
  const redis = getRedis();
  const key = `transfer:${direction}:${guildId}:${userId}`;

  try {
    const val = await redis.get(key);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export async function trackTransfer(
  guildId: string,
  fromUserId: string,
  toUserId: string,
  amount: number,
  netAmount: number
): Promise<void> {
  const redis = getRedis();

  // Calculate seconds until midnight UTC
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const ttl = Math.floor((midnight.getTime() - now.getTime()) / 1000);

  const outKey = `transfer:out:${guildId}:${fromUserId}`;
  const inKey = `transfer:in:${guildId}:${toUserId}`;

  try {
    await redis.incrby(outKey, amount);
    await redis.expire(outKey, ttl);
    await redis.incrby(inKey, netAmount);
    await redis.expire(inKey, ttl);
  } catch {
    // Non-critical
  }
}

// ============================================
// Streak Helpers
// ============================================

export function calculateStreakMultiplier(
  streak: number,
  bonusPerDay: number,
  maxMultiplier: number
): number {
  const multiplier = 1 + (streak * bonusPerDay);
  return Math.min(multiplier, maxMultiplier);
}

// ============================================
// Format Helpers
// ============================================

export function formatCurrency(amount: number, info: CurrencyInfo): string {
  return `${info.emoji} **${amount.toLocaleString()}** ${info.name}`;
}

export function balanceEmbed(
  userId: string,
  username: string,
  avatarUrl: string,
  balance: { coins: number; gems: number; eventTokens: number },
  config: CurrencyConfig,
  streak?: number
): EmbedBuilder {
  const { currencies } = config;

  const embed = new EmbedBuilder()
    .setColor(Colors.Economy)
    .setTitle(`${username}'s Balance`)
    .setThumbnail(avatarUrl)
    .addFields(
      {
        name: `${currencies.coins.emoji} ${currencies.coins.name}`,
        value: balance.coins.toLocaleString(),
        inline: true,
      },
      {
        name: `${currencies.gems.emoji} ${currencies.gems.name}`,
        value: balance.gems.toLocaleString(),
        inline: true,
      },
    );

  // Only show event tokens if they're configured (dailyAmount > 0 or user has some)
  if (currencies.event_tokens.dailyAmount > 0 || balance.eventTokens > 0) {
    embed.addFields({
      name: `${currencies.event_tokens.emoji} ${currencies.event_tokens.name}`,
      value: balance.eventTokens.toLocaleString(),
      inline: true,
    });
  }

  if (streak !== undefined && streak > 0) {
    const multiplier = calculateStreakMultiplier(streak, config.streakBonusMultiplier, config.streakMaxMultiplier);
    embed.addFields({
      name: '🔥 Daily Streak',
      value: `${streak} day${streak !== 1 ? 's' : ''} (${multiplier.toFixed(1)}x bonus)`,
      inline: true,
    });
  }

  embed.setTimestamp();
  return embed;
}
