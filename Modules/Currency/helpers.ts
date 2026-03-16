import { getDb } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { guildMembers, transactions } from '../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { ContainerBuilder, MessageFlags } from 'discord.js';
import { balanceContainer as buildBalanceContainer } from '../../Shared/src/utils/componentsV2';

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
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  if (amount <= 0) return { success: false, newBalance: 0, error: 'Amount must be positive.' };
  await ensureMember(guildId, userId);

  const db = getDb();
  const col = getCurrencyDbColumn(type);

  // Check current balance
  const balance = await getBalance(guildId, userId);
  const currentBalance = type === 'coins' ? balance.coins : type === 'gems' ? balance.gems : balance.eventTokens;

  if (currentBalance < amount) {
    return { success: false, newBalance: currentBalance, error: 'Insufficient balance.' };
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
  const key = `transfer:${direction}:${guildId}:${userId}`;

  try {
    const val = cache.get<number>(key);
    return val || 0;
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
  // Calculate seconds until midnight UTC
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const ttl = Math.floor((midnight.getTime() - now.getTime()) / 1000);

  const outKey = `transfer:out:${guildId}:${fromUserId}`;
  const inKey = `transfer:in:${guildId}:${toUserId}`;

  try {
    const currentOut = cache.get<number>(outKey) || 0;
    cache.set(outKey, currentOut + amount, ttl);
    const currentIn = cache.get<number>(inKey) || 0;
    cache.set(inKey, currentIn + netAmount, ttl);
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

export function balanceContainer(
  userId: string,
  username: string,
  avatarUrl: string,
  balance: { coins: number; gems: number; eventTokens: number },
  config: CurrencyConfig,
  streak?: number
): ContainerBuilder {
  const { currencies } = config;

  const fields: Array<{ emoji: string; name: string; value: string }> = [
    {
      emoji: currencies.coins.emoji,
      name: currencies.coins.name,
      value: balance.coins.toLocaleString(),
    },
    {
      emoji: currencies.gems.emoji,
      name: currencies.gems.name,
      value: balance.gems.toLocaleString(),
    },
  ];

  // Only show event tokens if they're configured (dailyAmount > 0 or user has some)
  if (currencies.event_tokens.dailyAmount > 0 || balance.eventTokens > 0) {
    fields.push({
      emoji: currencies.event_tokens.emoji,
      name: currencies.event_tokens.name,
      value: balance.eventTokens.toLocaleString(),
    });
  }

  if (streak !== undefined && streak > 0) {
    const multiplier = calculateStreakMultiplier(streak, config.streakBonusMultiplier, config.streakMaxMultiplier);
    fields.push({
      emoji: '🔥',
      name: 'Daily Streak',
      value: `${streak} day${streak !== 1 ? 's' : ''} (${multiplier.toFixed(1)}x bonus)`,
    });
  }

  return buildBalanceContainer({
    username,
    avatarUrl,
    fields,
    streak: streak,
    footerText: `ID: ${userId}`,
  });
}

// ============================================
// BANKING HELPERS
// ============================================

export async function ensureBankAccount(guildId: string, userId: string): Promise<void> {
  const db = getDb();
  await ensureMember(guildId, userId);
  await db.execute(sql`
    INSERT INTO banks (guild_id, user_id, balance, savings_balance)
    VALUES (${guildId}, ${userId}, 0, 0)
    ON CONFLICT (guild_id, user_id) DO NOTHING
  `);
}

export async function getBankBalance(guildId: string, userId: string): Promise<{
  bankBalance: number;
  savingsBalance: number;
  totalNetWorth: number;
  walletBalance: number;
  depositLimitRemaining: number;
  padlockActive: boolean;
  padlockExpires?: Date;
}> {
  await ensureBankAccount(guildId, userId);
  const db = getDb();

  // Get wallet balance
  const walletData = await db
    .select({ coins: guildMembers.coins })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
    .limit(1);

  const walletBalance = Number(walletData[0]?.coins ?? 0);

  // Get bank data
  const bankData = await db.execute(sql`
    SELECT
      balance,
      savings_balance,
      daily_deposited,
      last_deposit_reset,
      deposit_limit,
      padlock_active,
      padlock_expires
    FROM banks
    WHERE guild_id = ${guildId} AND user_id = ${userId}
    LIMIT 1
  ` as any);

  if (!bankData || bankData.rows.length === 0) {
    return {
      bankBalance: 0,
      savingsBalance: 0,
      totalNetWorth: walletBalance,
      walletBalance,
      depositLimitRemaining: 10000,
      padlockActive: false,
    };
  }

  const bank = bankData.rows[0] as any;
  const bankBalance = Number(bank.balance ?? 0);
  const savingsBalance = Number(bank.savings_balance ?? 0);
  const dailyDeposited = Number(bank.daily_deposited ?? 0);
  const lastDepositReset = bank.last_deposit_reset ? new Date(bank.last_deposit_reset) : null;
  const depositLimit = Number(bank.deposit_limit ?? 10000);
  const padlockActive = bank.padlock_active === true;
  const padlockExpires = bank.padlock_expires ? new Date(bank.padlock_expires) : undefined;

  // Check if deposit counter should reset (daily)
  let currentDailyDeposited = dailyDeposited;
  if (lastDepositReset) {
    const now = new Date();
    const lastResetDate = new Date(lastDepositReset);
    const daysSinceReset = Math.floor((now.getTime() - lastResetDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceReset >= 1) {
      currentDailyDeposited = 0;
    }
  }

  return {
    bankBalance,
    savingsBalance,
    totalNetWorth: walletBalance + bankBalance + savingsBalance,
    walletBalance,
    depositLimitRemaining: Math.max(0, depositLimit - currentDailyDeposited),
    padlockActive,
    padlockExpires,
  };
}

export async function depositToBank(
  guildId: string,
  userId: string,
  amount: number
): Promise<{ success: boolean; error?: string; newBankBalance: number }> {
  if (amount <= 0) {
    return { success: false, error: 'Amount must be positive.', newBankBalance: 0 };
  }

  const balance = await getBalance(guildId, userId);
  if (balance.coins < amount) {
    return { success: false, error: `You don't have enough coins. You have ${balance.coins}.`, newBankBalance: 0 };
  }

  // Check daily deposit limit
  const bankData = await getBankBalance(guildId, userId);
  if (bankData.depositLimitRemaining < amount) {
    return {
      success: false,
      error: `You can only deposit ${bankData.depositLimitRemaining} more coins today.`,
      newBankBalance: bankData.bankBalance,
    };
  }

  await ensureBankAccount(guildId, userId);
  const db = getDb();

  // Remove from wallet
  await removeCurrency(guildId, userId, 'coins', amount, 'bank_deposit');

  // Add to bank
  await db.execute(sql`
    UPDATE banks
    SET balance = balance + ${amount},
        daily_deposited = daily_deposited + ${amount},
        last_deposit_reset = COALESCE(last_deposit_reset, NOW())
    WHERE guild_id = ${guildId} AND user_id = ${userId}
  `);

  const updatedBankData = await db.execute(sql`
    SELECT balance FROM banks
    WHERE guild_id = ${guildId} AND user_id = ${userId}
    LIMIT 1
  ` as any);

  const newBankBalance = updatedBankData?.rows[0]?.balance ? Number(updatedBankData.rows[0].balance) : 0;

  logger.debug('Deposited to bank', { guildId, userId, amount, newBankBalance });
  return { success: true, newBankBalance };
}

export async function withdrawFromBank(
  guildId: string,
  userId: string,
  amount: number
): Promise<{ success: boolean; error?: string; newBankBalance: number }> {
  if (amount <= 0) {
    return { success: false, error: 'Amount must be positive.', newBankBalance: 0 };
  }

  const bankData = await getBankBalance(guildId, userId);
  if (bankData.bankBalance < amount) {
    return { success: false, error: `You don't have enough coins in the bank. You have ${bankData.bankBalance}.`, newBankBalance: bankData.bankBalance };
  }

  await ensureBankAccount(guildId, userId);
  const db = getDb();

  // Remove from bank
  await db.execute(sql`
    UPDATE banks
    SET balance = balance - ${amount}
    WHERE guild_id = ${guildId} AND user_id = ${userId}
  `);

  // Add to wallet
  await addCurrency(guildId, userId, 'coins', amount, 'bank_withdrawal');

  const updatedBankData = await db.execute(sql`
    SELECT balance FROM banks
    WHERE guild_id = ${guildId} AND user_id = ${userId}
    LIMIT 1
  ` as any);

  const newBankBalance = updatedBankData?.rows[0]?.balance ? Number(updatedBankData.rows[0].balance) : 0;

  logger.debug('Withdrew from bank', { guildId, userId, amount, newBankBalance });
  return { success: true, newBankBalance };
}

// ============================================
// EARNING HELPERS
// ============================================

export async function checkEarnCooldown(guildId: string, userId: string, action: string): Promise<number> {
  const key = `earn_cd:${guildId}:${userId}:${action}`;

  try {
    if (!cache.has(key)) return 0;
    // Since CacheManager doesn't directly expose TTL, we'll use a workaround with a timestamp
    const data = cache.get<{ timestamp: number }>(key);
    if (!data) return 0;
    const remaining = Math.max(0, Math.ceil((data.timestamp - Date.now()) / 1000));
    return remaining;
  } catch {
    return 0;
  }
}

export async function setEarnCooldown(guildId: string, userId: string, action: string, seconds: number): Promise<void> {
  const key = `earn_cd:${guildId}:${userId}:${action}`;

  try {
    cache.set(key, { timestamp: Date.now() + seconds * 1000 }, seconds);
  } catch (error) {
    logger.error('Error setting earn cooldown:', error);
  }
}

export async function checkJail(guildId: string, userId: string): Promise<boolean> {
  const key = `jail:${guildId}:${userId}`;

  try {
    return cache.has(key);
  } catch {
    return false;
  }
}

export async function setJail(guildId: string, userId: string, durationSeconds: number): Promise<void> {
  const key = `jail:${guildId}:${userId}`;

  try {
    cache.set(key, '1', durationSeconds);
  } catch (error) {
    logger.error('Error setting jail:', error);
  }
}

export async function getJailTimeRemaining(guildId: string, userId: string): Promise<number> {
  const key = `jail:${guildId}:${userId}`;

  try {
    if (!cache.has(key)) return 0;
    const data = cache.get<{ timestamp: number }>(key);
    if (!data) return 0;
    const remaining = Math.max(0, Math.ceil((data.timestamp - Date.now()) / 1000));
    return remaining;
  } catch {
    return 0;
  }
}

// ============================================
// JOB HELPERS
// ============================================

export const DEFAULT_JOBS = [
  // Tier 1
  { jobId: 'janitor', name: 'Janitor', emoji: '🧹', tier: 1, salary: 50 },
  { jobId: 'dishwasher', name: 'Dishwasher', emoji: '🍽️', tier: 1, salary: 60 },
  { jobId: 'dog_walker', name: 'Dog Walker', emoji: '🐕', tier: 1, salary: 70 },
  { jobId: 'babysitter', name: 'Babysitter', emoji: '👶', tier: 1, salary: 80 },
  { jobId: 'cashier', name: 'Cashier', emoji: '💳', tier: 1, salary: 90 },
  // Tier 2
  { jobId: 'mechanic', name: 'Mechanic', emoji: '🔧', tier: 2, salary: 200 },
  { jobId: 'chef', name: 'Chef', emoji: '👨‍🍳', tier: 2, salary: 220 },
  { jobId: 'electrician', name: 'Electrician', emoji: '⚡', tier: 2, salary: 250 },
  { jobId: 'barista', name: 'Barista', emoji: '☕', tier: 2, salary: 180 },
  { jobId: 'delivery_driver', name: 'Delivery Driver', emoji: '🚗', tier: 2, salary: 190 },
  // Tier 3
  { jobId: 'teacher', name: 'Teacher', emoji: '📚', tier: 3, salary: 450 },
  { jobId: 'nurse', name: 'Nurse', emoji: '⚕️', tier: 3, salary: 500 },
  { jobId: 'accountant', name: 'Accountant', emoji: '💼', tier: 3, salary: 550 },
  { jobId: 'developer', name: 'Developer', emoji: '💻', tier: 3, salary: 600 },
  { jobId: 'designer', name: 'Designer', emoji: '🎨', tier: 3, salary: 480 },
  // Tier 4
  { jobId: 'manager', name: 'Manager', emoji: '👔', tier: 4, salary: 900 },
  { jobId: 'director', name: 'Director', emoji: '🎬', tier: 4, salary: 1000 },
  { jobId: 'lawyer', name: 'Lawyer', emoji: '⚖️', tier: 4, salary: 1100 },
  { jobId: 'surgeon', name: 'Surgeon', emoji: '🏥', tier: 4, salary: 1200 },
  { jobId: 'architect', name: 'Architect', emoji: '🏗️', tier: 4, salary: 950 },
  // Tier 5
  { jobId: 'ceo', name: 'CEO', emoji: '🏢', tier: 5, salary: 2000 },
  { jobId: 'cto', name: 'CTO', emoji: '🖥️', tier: 5, salary: 1800 },
  { jobId: 'president', name: 'President', emoji: '⭐', tier: 5, salary: 2500 },
  { jobId: 'tycoon', name: 'Tycoon', emoji: '💰', tier: 5, salary: 3000 },
  { jobId: 'billionaire', name: 'Billionaire', emoji: '🤑', tier: 5, salary: 5000 },
];

export async function ensureDefaultJobs(guildId: string): Promise<void> {
  const db = getDb();

  try {
    for (const job of DEFAULT_JOBS) {
      await db.execute(sql`
        INSERT INTO job_listings (guild_id, job_id, name, description, emoji, tier, salary, shift_cooldown_ms, shifts_per_day, is_default, created_at)
        VALUES (${guildId}, ${job.jobId}, ${job.name}, ${job.name}, ${job.emoji}, ${job.tier}, ${job.salary}, 3600000, 8, true, NOW())
        ON CONFLICT (guild_id, job_id) DO NOTHING
      `);
    }
  } catch (error) {
    logger.error('Error ensuring default jobs:', error);
  }
}

export async function getUserJob(guildId: string, userId: string): Promise<any> {
  const db = getDb();

  try {
    const jobData = await db.execute(sql`
      SELECT
        uj.id,
        uj.job_id,
        uj.tier,
        uj.salary,
        uj.hired_at,
        uj.last_shift,
        uj.shifts_today,
        uj.shifts_completed,
        uj.total_earned,
        uj.warning_count,
        uj.last_warning,
        uj.promotion_progress,
        uj.is_active,
        uj.fired_at,
        uj.fire_reason,
        jl.name,
        jl.emoji
      FROM user_jobs uj
      LEFT JOIN job_listings jl ON uj.guild_id = jl.guild_id AND uj.job_id = jl.job_id
      WHERE uj.guild_id = ${guildId} AND uj.user_id = ${userId} AND uj.is_active = true
      LIMIT 1
    ` as any);

    return jobData?.rows[0] || null;
  } catch (error) {
    logger.error('Error getting user job:', error);
    return null;
  }
}

export async function getAvailableJobs(guildId: string, tier?: number): Promise<any[]> {
  const db = getDb();

  try {
    await ensureDefaultJobs(guildId);

    let query = sql`
      SELECT
        job_id,
        name,
        emoji,
        tier,
        salary,
        description
      FROM job_listings
      WHERE guild_id = ${guildId}
    `;

    if (tier !== undefined) {
      query = sql`
        SELECT
          job_id,
          name,
          emoji,
          tier,
          salary,
          description
        FROM job_listings
        WHERE guild_id = ${guildId} AND tier = ${tier}
      `;
    }

    const jobs = await db.execute(query as any);
    return jobs?.rows || [];
  } catch (error) {
    logger.error('Error getting available jobs:', error);
    return [];
  }
}
