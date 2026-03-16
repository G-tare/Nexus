import { getDb } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { donations } from '../../Shared/src/database/models/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('DonationTracking');

// ============================================
// Config Interface
// ============================================

export interface DonationConfig {
  defaultChannelId: string | null;
  currencyType: 'coins' | 'gems' | 'event_tokens';
  goalAmount: number;
  goalName: string;
  goalActive: boolean;
  announceMilestones: boolean;
  milestonePercents: number[];
  leaderboardSize: number;
  minDonation: number;
  maxDonation: number;
  embedColor: string;
  logChannelId: string | null;
}

const DEFAULT_CONFIG: DonationConfig = {
  defaultChannelId: null,
  currencyType: 'coins',
  goalAmount: 0,
  goalName: '',
  goalActive: false,
  announceMilestones: true,
  milestonePercents: [25, 50, 75, 100],
  leaderboardSize: 10,
  minDonation: 1,
  maxDonation: 50000,
  embedColor: '#2ECC71',
  logChannelId: null,
};

// ============================================
// Config Management
// ============================================

export async function getDonationConfig(guildId: string): Promise<DonationConfig> {
  const cfg = await moduleConfig.getModuleConfig(guildId, 'donationtracking');
  const config = (cfg?.config ?? {}) as Record<string, any>;
  return {
    defaultChannelId: config?.defaultChannelId ?? DEFAULT_CONFIG.defaultChannelId,
    currencyType: config?.currencyType ?? DEFAULT_CONFIG.currencyType,
    goalAmount: config?.goalAmount ?? DEFAULT_CONFIG.goalAmount,
    goalName: config?.goalName ?? DEFAULT_CONFIG.goalName,
    goalActive: config?.goalActive ?? DEFAULT_CONFIG.goalActive,
    announceMilestones: config?.announceMilestones ?? DEFAULT_CONFIG.announceMilestones,
    milestonePercents: config?.milestonePercents ?? DEFAULT_CONFIG.milestonePercents,
    leaderboardSize: config?.leaderboardSize ?? DEFAULT_CONFIG.leaderboardSize,
    minDonation: config?.minDonation ?? DEFAULT_CONFIG.minDonation,
    maxDonation: config?.maxDonation ?? DEFAULT_CONFIG.maxDonation,
    embedColor: config?.embedColor ?? DEFAULT_CONFIG.embedColor,
    logChannelId: config?.logChannelId ?? DEFAULT_CONFIG.logChannelId,
  };
}

export async function updateDonationConfig(
  guildId: string,
  updates: Partial<DonationConfig>
): Promise<void> {
  const current = await getDonationConfig(guildId);
  const merged = { ...current, ...updates };

  await moduleConfig.setConfig(guildId, 'donationtracking', merged);

  // Clear cache
  try {
    cache.del(`donation:config:${guildId}`);
  } catch {
    // Non-critical
  }
}

// ============================================
// Donation CRUD
// ============================================

export interface DonationRecord {
  id: number;
  guildId: string;
  userId: string;
  amount: number;
  currencyType: string;
  campaignName: string | null;
  message: string | null;
  createdAt: Date;
}

export async function recordDonation(
  guildId: string,
  userId: string,
  amount: number,
  currencyType: string,
  campaignName?: string,
  message?: string
): Promise<DonationRecord> {
  const db = getDb();

  const [result] = await db
    .insert(donations)
    .values({
      guildId,
      userId,
      amount,
      currencyType,
      campaignName: campaignName || null,
      message: message || null,
    })
    .returning();

  return result as DonationRecord;
}

// ============================================
// Donation Queries
// ============================================

export async function getTotalDonations(
  guildId: string,
  campaignName?: string
): Promise<number> {
  const db = getDb();

  const conditions = campaignName
    ? and(eq(donations.guildId, guildId), eq(donations.campaignName, campaignName))
    : eq(donations.guildId, guildId);

  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${donations.amount}), 0)` })
    .from(donations)
    .where(conditions);

  return Number(result[0]?.total ?? 0);
}

export async function getUserDonations(
  guildId: string,
  userId: string,
  campaignName?: string
): Promise<number> {
  const db = getDb();

  const conditions = campaignName
    ? and(eq(donations.guildId, guildId), eq(donations.userId, userId), eq(donations.campaignName, campaignName))
    : and(eq(donations.guildId, guildId), eq(donations.userId, userId));

  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${donations.amount}), 0)` })
    .from(donations)
    .where(conditions);

  return Number(result[0]?.total ?? 0);
}

export interface LeaderboardEntry {
  userId: string;
  totalDonated: number;
  donationCount: number;
}

export async function getDonationLeaderboard(
  guildId: string,
  limit: number = 10,
  campaignName?: string
): Promise<LeaderboardEntry[]> {
  const db = getDb();

  const conditions = campaignName
    ? and(eq(donations.guildId, guildId), eq(donations.campaignName, campaignName))
    : eq(donations.guildId, guildId);

  const results = await db
    .select({
      userId: donations.userId,
      totalDonated: sql<number>`COALESCE(SUM(${donations.amount}), 0)`,
      donationCount: sql<number>`COUNT(*)`,
    })
    .from(donations)
    .where(conditions)
    .groupBy(donations.userId)
    .orderBy(sql`SUM(${donations.amount}) DESC`)
    .limit(limit);

  return results.map((r) => ({
    userId: r.userId,
    totalDonated: Number(r.totalDonated ?? 0),
    donationCount: Number(r.donationCount ?? 0),
  }));
}

// ============================================
// Milestone Checking
// ============================================

export interface Milestone {
  percent: number;
  amount: number;
  crossed: boolean;
}

export function checkMilestones(
  oldTotal: number,
  newTotal: number,
  goalAmount: number,
  milestonePercents: number[]
): Milestone[] {
  if (goalAmount <= 0) return [];

  const milestones: Milestone[] = [];

  for (const percent of milestonePercents) {
    const targetAmount = Math.floor((goalAmount * percent) / 100);
    const wasCrossed = oldTotal >= targetAmount;
    const isCrossed = newTotal >= targetAmount;

    if (!wasCrossed && isCrossed) {
      milestones.push({
        percent,
        amount: targetAmount,
        crossed: true,
      });
    }
  }

  return milestones;
}

// ============================================
// Goal Progress
// ============================================

export interface GoalProgress {
  current: number;
  goal: number;
  percent: number;
  remaining: number;
  goalActive: boolean;
  goalName: string;
}

export async function getGoalProgress(guildId: string): Promise<GoalProgress> {
  const config = await getDonationConfig(guildId);
  const current = await getTotalDonations(guildId);

  return {
    current,
    goal: config.goalAmount,
    percent: config.goalAmount > 0 ? Math.min(100, (current / config.goalAmount) * 100) : 0,
    remaining: Math.max(0, config.goalAmount - current),
    goalActive: config.goalActive,
    goalName: config.goalName,
  };
}

// ============================================
// Progress Bar Visualization
// ============================================

export function createProgressBar(
  current: number,
  goal: number,
  barLength: number = 20
): string {
  if (goal <= 0) return '';

  const percent = Math.min(100, (current / goal) * 100);
  const filledLength = Math.round((barLength * percent) / 100);
  const emptyLength = barLength - filledLength;

  const filled = '▓'.repeat(filledLength);
  const empty = '░'.repeat(emptyLength);

  return `${filled}${empty} ${percent.toFixed(1)}%`;
}

// ============================================
// Cleanup
// ============================================

export async function resetGuildDonations(guildId: string): Promise<number> {
  const db = getDb();
  const result = await db.delete(donations).where(eq(donations.guildId, guildId));

  logger.info(`Reset donations for guild ${guildId}`);
  return result.rowCount ?? 0;
}

export async function getUserDonationHistory(
  guildId: string,
  userId: string,
  limit: number = 10
): Promise<DonationRecord[]> {
  const db = getDb();

  const results = await db
    .select()
    .from(donations)
    .where(and(eq(donations.guildId, guildId), eq(donations.userId, userId)))
    .orderBy(desc(donations.createdAt))
    .limit(limit);

  return results as DonationRecord[];
}
