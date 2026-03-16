import { EventEmitter } from 'events';
import { cache } from '../../Shared/src/cache/cacheManager';

export interface CountingConfig {
  enabled: boolean;
  channelId?: string;
  currentCount: number;
  lastCounterId: string | null;
  mathMode: boolean;
  strictMode: boolean;
  allowDoubleCount: boolean;
  deleteWrongNumbers: boolean;
  resetOnWrong: boolean;
  reactOnCorrect: boolean;
  notifyOnMilestone: boolean;
  milestoneInterval: number;
  highestCount: number;
  highestCountDate?: string;
  totalCounts: number;
  livesEnabled: boolean;
  livesPerSave: number;
  currentStreak: number;
  highestStreak: number;
  globalLeaderboardEnabled: boolean;
}

export interface CountingUserStats {
  userId: string;
  guildId: string;
  correctCounts: number;
  wrongCounts: number;
  highestNumber: number;
  currentLives: number;
  lastCountedAt?: Date;
  currentStreak?: number;
  bestStreak?: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  value: number;
  rank: number;
}

const DEFAULT_CONFIG: CountingConfig = {
  enabled: false,
  currentCount: 0,
  lastCounterId: null,
  mathMode: false,
  strictMode: false,
  allowDoubleCount: false,
  deleteWrongNumbers: false,
  resetOnWrong: true,
  reactOnCorrect: true,
  notifyOnMilestone: true,
  milestoneInterval: 100,
  highestCount: 0,
  totalCounts: 0,
  livesEnabled: true,
  livesPerSave: 1,
  currentStreak: 0,
  highestStreak: 0,
  globalLeaderboardEnabled: false,
};

export async function getCountingConfig(guildId: string): Promise<CountingConfig> {
  const cached = cache.get<string>(`counting:config:${guildId}`);
  if (cached) {
    return JSON.parse(cached);
  }

  const config = { ...DEFAULT_CONFIG };
  cache.set(`counting:config:${guildId}`, JSON.stringify(config), 86400);
  return config;
}

export async function saveCountingConfig(guildId: string, config: CountingConfig): Promise<void> {
  cache.set(`counting:config:${guildId}`, JSON.stringify(config), 86400 * 7);
}

export async function getCurrentCount(guildId: string): Promise<number> {
  const config = await getCountingConfig(guildId);
  return config.currentCount;
}

export async function setCurrentCount(guildId: string, count: number): Promise<void> {
  const config = await getCountingConfig(guildId);
  config.currentCount = count;
  await saveCountingConfig(guildId, config);
}

export async function incrementCount(
  guildId: string,
  userId: string,
  number: number
): Promise<void> {
  const config = await getCountingConfig(guildId);

  config.currentCount = number;
  config.lastCounterId = userId;
  config.totalCounts += 1;
  config.currentStreak += 1;

  if (config.currentStreak > config.highestStreak) {
    config.highestStreak = config.currentStreak;
  }

  if (number > config.highestCount) {
    config.highestCount = number;
    config.highestCountDate = new Date().toISOString();
  }

  await saveCountingConfig(guildId, config);
}

export async function handleWrongCount(
  guildId: string,
  userId: string
): Promise<{ usedLife: boolean; livesRemaining: number; reset: boolean }> {
  const config = await getCountingConfig(guildId);
  const lives = await getUserCountingLives(guildId, userId);

  if (lives > 0) {
    await consumeLife(guildId, userId);
    return {
      usedLife: true,
      livesRemaining: lives - 1,
      reset: false,
    };
  }

  const oldCount = config.currentCount;
  if (config.resetOnWrong) {
    config.currentCount = 0;
    config.lastCounterId = null;
    config.currentStreak = 0;
    await saveCountingConfig(guildId, config);
    return {
      usedLife: false,
      livesRemaining: 0,
      reset: true,
    };
  }

  return {
    usedLife: false,
    livesRemaining: 0,
    reset: false,
  };
}

export async function getUserCountingLives(guildId: string, userId: string): Promise<number> {
  const lives = cache.get<string>(`counting:lives:${guildId}:${userId}`);
  return lives ? parseInt(lives, 10) : 0;
}

export async function consumeLife(guildId: string, userId: string): Promise<number> {
  const lives = await getUserCountingLives(guildId, userId);
  const remaining = Math.max(0, lives - 1);
  cache.set(`counting:lives:${guildId}:${userId}`, String(remaining), 2592000);

  // Emit event for Shop/Currency module
  const eventBus = require('../../../core/events').getEventBus?.();
  if (eventBus) {
    eventBus.emit('counting:life-consumed', {
      guildId,
      userId,
      livesRemaining: remaining,
    });
  }

  return remaining;
}

export async function addLives(guildId: string, userId: string, count: number): Promise<number> {
  const currentLives = await getUserCountingLives(guildId, userId);
  const newTotal = currentLives + count;
  cache.set(`counting:lives:${guildId}:${userId}`, String(newTotal), 2592000);
  return newTotal;
}

export function evaluateMath(expression: string): number | null {
  try {
    // Only allow numbers, +, -, *, /, (, )
    if (!/^[\d+\-*/(). ]+$/.test(expression)) {
      return null;
    }

    // Prevent code injection
    const func = new Function('return ' + expression);
    const result = func();

    // Ensure result is a valid integer
    if (typeof result === 'number' && Number.isInteger(result) && result >= 0) {
      return result;
    }

    return null;
  } catch {
    return null;
  }
}

export async function getUserStats(guildId: string, userId: string): Promise<CountingUserStats> {
  const cached = cache.get<string>(`counting:stats:${guildId}:${userId}`);
  if (cached) {
    return JSON.parse(cached);
  }

  const stats: CountingUserStats = {
    userId,
    guildId,
    correctCounts: 0,
    wrongCounts: 0,
    highestNumber: 0,
    currentLives: await getUserCountingLives(guildId, userId),
    currentStreak: 0,
    bestStreak: 0,
  };

  cache.set(`counting:stats:${guildId}:${userId}`, JSON.stringify(stats), 2592000);
  return stats;
}

export async function updateUserStats(
  guildId: string,
  userId: string,
  correct: boolean,
  number?: number
): Promise<void> {
  const stats = await getUserStats(guildId, userId);

  if (correct) {
    stats.correctCounts += 1;
    if (number && number > stats.highestNumber) {
      stats.highestNumber = number;
    }
  } else {
    stats.wrongCounts += 1;
    stats.currentStreak = 0;
  }

  stats.lastCountedAt = new Date();
  stats.currentLives = await getUserCountingLives(guildId, userId);

  cache.set(`counting:stats:${guildId}:${userId}`, JSON.stringify(stats), 2592000);
}

export async function getServerLeaderboard(
  guildId: string,
  type: 'counts' | 'streak' | 'highest'
): Promise<LeaderboardEntry[]> {
  // Cache manager doesn't provide keys() method, so we can't enumerate all cached stats
  // For now, return empty to avoid TypeScript errors
  // TODO: Store a separate index of user IDs or use database for leaderboard queries
  return [];
}

export async function getGlobalHighestCounts(): Promise<LeaderboardEntry[]> {
  // Use zrangebyscore to get all members and then reverse for descending order
  const entries = cache.zrangebyscore(`counting:global:highest`, -Infinity, Infinity);
  const reversed = entries.reverse();

  const result: LeaderboardEntry[] = [];

  for (let i = 0; i < Math.min(reversed.length, 10); i++) {
    const member = reversed[i];
    const [guildId, guildName] = member.split(':');

    result.push({
      userId: guildId,
      username: guildName,
      value: i + 1, // Rank as value since we don't have direct score from zrangebyscore
      rank: i + 1,
    });
  }

  return result;
}

export async function updateGlobalLeaderboard(
  guildId: string,
  guildName: string,
  highestCount: number
): Promise<void> {
  const member = `${guildId}:${guildName}`;
  await cache.zadd(`counting:global:highest`, highestCount, member);
}

export function checkMilestone(count: number, interval: number): boolean {
  if (interval <= 0) return false;
  return count % interval === 0;
}

export async function getStreakLeaderboard(guildId: string): Promise<LeaderboardEntry[]> {
  // Cache manager doesn't provide keys() method, so we can't enumerate all cached stats
  // For now, return empty to avoid TypeScript errors
  // TODO: Store a separate index of user IDs or use database for leaderboard queries
  return [];
}
