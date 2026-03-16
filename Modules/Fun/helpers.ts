import { GuildMember, ContainerBuilder, TextDisplayBuilder, MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { cache } from '../../Shared/src/cache/cacheManager';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleContainer, addText, addFields, addMediaGallery, v2Payload } from '../../Shared/src/utils/componentsV2';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Fun');

export interface FunConfig {
  enabled: boolean;
  gamesEnabled: boolean;
  interactionsEnabled: boolean;
  randomEnabled: boolean;
  cooldownSeconds: number;
  gamblingEnabled: boolean;
  maxBet: number;
  minBet: number;
  disabledCommands: string[];
  interactionGifsEnabled: boolean;
}

const DEFAULT_FUN_CONFIG: FunConfig = {
  enabled: true,
  gamesEnabled: true,
  interactionsEnabled: true,
  randomEnabled: true,
  cooldownSeconds: 5,
  gamblingEnabled: true,
  maxBet: 10000,
  minBet: 10,
  disabledCommands: [],
  interactionGifsEnabled: true,
};

/**
 * Get Fun module config for a guild with defaults
 */
export async function getFunConfig(guildId: string): Promise<FunConfig> {
  try {
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'fun');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
    return { ...DEFAULT_FUN_CONFIG, ...config };
  } catch (error) {
    logger.warn(`Failed to get Fun config for guild ${guildId}, using defaults`, error);
    return DEFAULT_FUN_CONFIG;
  }
}

/**
 * Check if user is on cooldown for a specific command
 * Returns remaining cooldown in seconds, or 0 if no cooldown
 */
export async function checkCooldown(
  guildId: string,
  userId: string,
  command: string
): Promise<number> {
  try {
    const cooldownKey = `fun:cooldown:${guildId}:${userId}:${command}`;
    if (!cache.has(cooldownKey)) return 0;
    const data = cache.get<{ timestamp: number }>(cooldownKey);
    if (!data) return 0;
    const remaining = Math.max(0, Math.ceil((data.timestamp - Date.now()) / 1000));
    return remaining;
  } catch (error) {
    logger.error(`Error checking cooldown for ${userId}/${command}`, error);
    return 0;
  }
}

/**
 * Set cooldown for a user on a specific command
 */
export async function setCooldown(
  guildId: string,
  userId: string,
  command: string,
  seconds: number
): Promise<void> {
  try {
    const cooldownKey = `fun:cooldown:${guildId}:${userId}:${command}`;
    cache.set(cooldownKey, { timestamp: Date.now() + seconds * 1000 }, seconds);
  } catch (error) {
    logger.error(`Error setting cooldown for ${userId}/${command}`, error);
  }
}

/**
 * Emit gameWon event for Currency module to process
 */
export function emitGameWon(
  guildId: string,
  userId: string,
  game: string,
  bet?: number,
  winnings?: number
): void {
  try {
    eventBus.emit('gameWon', {
      guildId,
      userId,
      game,
      bet,
      reward: winnings,
    });
  } catch (error) {
    logger.error(`Error emitting gameWon event for ${userId}`, error);
  }
}

/**
 * Emit gameLost event for Currency module to process
 */
export function emitGameLost(
  guildId: string,
  userId: string,
  game: string,
  bet?: number
): void {
  try {
    eventBus.emit('gameLost', {
      guildId,
      userId,
      game,
      bet,
    });
  } catch (error) {
    logger.error(`Error emitting gameLost event for ${userId}`, error);
  }
}

/**
 * Validate and place a bet, deducting currency from user
 * Requires Currency module helpers to be available
 */
export async function placeBet(
  guildId: string,
  userId: string,
  amount: number,
  config: FunConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate bet amount
    if (amount < config.minBet) {
      return { success: false, error: `Minimum bet is ${config.minBet}` };
    }
    if (amount > config.maxBet) {
      return { success: false, error: `Maximum bet is ${config.maxBet}` };
    }

    // TODO: Call Currency module helper to deduct currency
    // For now, we assume the Currency module will handle validation
    // Example: const deducted = await currencyHelpers.deductCurrency(guildId, userId, amount);

    return { success: true };
  } catch (error) {
    logger.error(`Error placing bet for ${userId}`, error);
    return { success: false, error: 'Failed to place bet' };
  }
}

/**
 * Award winnings to a user
 * TODO: Connect to Currency module helpers
 */
export async function awardWinnings(
  guildId: string,
  userId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // TODO: Call Currency module helper to add currency
    // Example: const awarded = await currencyHelpers.addCurrency(guildId, userId, amount);

    return { success: true };
  } catch (error) {
    logger.error(`Error awarding winnings to ${userId}`, error);
    return { success: false, error: 'Failed to award winnings' };
  }
}

/**
 * Fetch a random GIF from Tenor or Giphy API
 * TODO: Implement actual API calls
 */
export async function getRandomGif(query: string): Promise<string> {
  try {
    // TODO: Implement Tenor or Giphy API integration
    // For now, return placeholder
    logger.debug(`Getting random GIF for query: ${query}`);
    return 'https://media.giphy.com/media/3o6ZtpWzLwMEymzk4w/giphy.gif';
  } catch (error) {
    logger.error(`Error getting random GIF for query "${query}"`, error);
    return 'https://media.giphy.com/media/3o6ZtpWzLwMEymzk4w/giphy.gif';
  }
}

/**
 * Build a standard game container
 */
export function buildGameContainer(
  title: string,
  description: string
): ContainerBuilder {
  const container = moduleContainer('fun');
  addText(container, `### ${title}`);
  if (description) {
    addText(container, description);
  }
  return container;
}

/**
 * Build an interaction container (e.g., "X hugged Y")
 */
export function buildInteractionContainer(
  user: GuildMember,
  target: GuildMember,
  action: string,
  gifUrl?: string
): ContainerBuilder {
  const container = moduleContainer('fun');
  addText(container, `### ${user.displayName} ${action} ${target.displayName}`);

  if (gifUrl) {
    addMediaGallery(container, [{ url: gifUrl }]);
  }

  return container;
}

/**
 * Get a random element from an array
 */
export function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Fisher-Yates shuffle algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
