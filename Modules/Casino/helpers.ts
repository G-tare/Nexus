import { getDb } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { casinoHistory } from '../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { removeCurrency, addCurrency } from '../Currency/helpers';

export interface CasinoConfig {
  enabled: boolean;
  minBet: number;
  maxBet: number;
  currencyType: string;
  cooldown: number;
  houseEdge: number;
  embedColor: string;
  logChannelId: string | null;
  dailyLossLimit: number;
  jackpotPool: number;
}

export async function getCasinoConfig(_guildId: string): Promise<CasinoConfig> {
  // In production, fetch from moduleConfig table
  // For now, return defaults
  return {
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
}

export async function placeBet(
  guildId: string,
  userId: string,
  amount: number,
  config: CasinoConfig
): Promise<{ success: boolean; error?: string }> {
  // Validate bet amount
  if (amount < config.minBet) {
    return {
      success: false,
      error: `Minimum bet is ${config.minBet} ${config.currencyType}`,
    };
  }

  if (amount > config.maxBet) {
    return {
      success: false,
      error: `Maximum bet is ${config.maxBet} ${config.currencyType}`,
    };
  }

  // Check balance and deduct
  try {
    const result = await removeCurrency(guildId, userId, 'coins', amount, 'casino_bet');
    if (!result.success) {
      return {
        success: false,
        error: `Insufficient balance. You need ${amount} ${config.currencyType}`,
      };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to process bet',
    };
  }
}

export async function awardWinnings(
  guildId: string,
  userId: string,
  amount: number
): Promise<void> {
  await addCurrency(guildId, userId, 'coins', amount, 'casino_win');
}

export async function logCasinoGame(
  guildId: string,
  userId: string,
  game: string,
  betAmount: number,
  winAmount: number,
  multiplier: number,
  result: 'win' | 'loss' | 'push',
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  try {
    await db.insert(casinoHistory).values({
      guildId,
      userId,
      game,
      betAmount,
      winAmount,
      multiplier,
      result,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('[Casino] Failed to log game:', error);
  }
}

export async function checkCooldown(
  guildId: string,
  userId: string,
  game: string
): Promise<boolean> {
  const key = `casino_cd:${guildId}:${userId}:${game}`;
  return !cache.has(key); // true if no cooldown
}

export async function setCooldown(
  guildId: string,
  userId: string,
  game: string,
  seconds: number
): Promise<void> {
  const key = `casino_cd:${guildId}:${userId}:${game}`;
  cache.set(key, '1', seconds);
}

// Note: buildCasinoEmbed is deprecated in V2 migration
// Use moduleContainer('casino') with addText/addFields instead

export function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function exponentialDistribution(max: number): number {
  // Generate crash point using exponential distribution
  const lambda = 0.1;
  return Math.max(1.0, max * (1 - Math.exp(-lambda * Math.random())));
}

// Card utilities
export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
}

export function createDeck(): Card[] {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const values: Card['value'][] = [
    'A',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'J',
    'Q',
    'K',
  ];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value });
    }
  }

  return deck.sort(() => Math.random() - 0.5);
}

export function getCardEmoji(card: Card): string {
  const suitMap = {
    hearts: '♥️',
    diamonds: '♦️',
    clubs: '♣️',
    spades: '♠️',
  };

  return `${card.value}${suitMap[card.suit]}`;
}

export function getCardValue(card: Card): number {
  if (card.value === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  return parseInt(card.value, 10);
}

export function calculateHandValue(cards: Card[]): number {
  let value = 0;
  let aces = 0;

  for (const card of cards) {
    const cardValue = getCardValue(card);
    if (card.value === 'A') aces++;
    value += cardValue;
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
