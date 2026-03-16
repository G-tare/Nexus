import { TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder } from 'discord.js';
import crypto from 'crypto';
import { cache } from '../../Shared/src/cache/cacheManager';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { moduleContainer, addText } from '../../Shared/src/utils/componentsV2';

const CONFESSION_SALT = 'confessions_salt_v1';

export interface ConfessionConfig {
  enabled: boolean;
  channelId?: string;
  moderationEnabled: boolean;
  moderationChannelId?: string;
  fullAnonymity: boolean;
  cooldownSeconds: number;
  blacklistedWords: string[];
  confessionCounter: number;
  allowImages: boolean;
  embedColor: string;
  bannedHashes: string[];
}

const DEFAULT_CONFIG: ConfessionConfig = {
  enabled: true,
  moderationEnabled: false,
  fullAnonymity: false,
  cooldownSeconds: 300,
  blacklistedWords: [],
  confessionCounter: 0,
  allowImages: false,
  embedColor: '#9B59B6',
  bannedHashes: [],
};

/**
 * Get confession config with defaults for a guild.
 * Also respects the module-level enabled toggle from the dashboard.
 */
export async function getConfessionConfig(guildId: string): Promise<ConfessionConfig> {
  let config: ConfessionConfig;
  const cached = cache.get<ConfessionConfig>(`confessions_config:${guildId}`);
  if (cached) {
    config = { ...DEFAULT_CONFIG, ...cached };
  } else {
    config = { ...DEFAULT_CONFIG };
  }

  // If the module-level toggle is off (dashboard), override enabled to false
  const moduleEnabled = await moduleConfig.isEnabled(guildId, 'confessions');
  if (!moduleEnabled) {
    config.enabled = false;
  }

  return config;
}

/**
 * Set confession config for a guild
 */
export async function setConfessionConfig(guildId: string, config: Partial<ConfessionConfig>): Promise<void> {
  const current = await getConfessionConfig(guildId);
  const updated = { ...current, ...config };
  cache.set(`confessions_config:${guildId}`, updated, 86400 * 30);
}

/**
 * Get next confession number and increment counter
 */
export async function getNextConfessionNumber(guildId: string): Promise<number> {
  const config = await getConfessionConfig(guildId);
  const next = config.confessionCounter + 1;
  await setConfessionConfig(guildId, { confessionCounter: next });
  return next;
}

/**
 * Create SHA256 hash of userId for anonymity
 */
export function hashUserId(userId: string, guildId: string): string {
  const input = `${userId}:${guildId}:${CONFESSION_SALT}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Check if user is banned from confessions
 */
export async function isConfessionBanned(guildId: string, userId: string): Promise<boolean> {
  const config = await getConfessionConfig(guildId);
  const userHash = hashUserId(userId, guildId);
  return config.bannedHashes.includes(userHash);
}

/**
 * Ban user by looking up confession ID and hashing
 */
export async function banByConfessionId(guildId: string, confessionId: number): Promise<boolean> {
  const confessionData = await getConfessionData(guildId, confessionId);
  if (!confessionData) return false;

  const config = await getConfessionConfig(guildId);
  if (!config.bannedHashes.includes(confessionData.userHash)) {
    config.bannedHashes.push(confessionData.userHash);
    await setConfessionConfig(guildId, { bannedHashes: config.bannedHashes });
  }
  return true;
}

/**
 * Unban user by looking up confession ID
 */
export async function unbanByConfessionId(guildId: string, confessionId: number): Promise<boolean> {
  const confessionData = await getConfessionData(guildId, confessionId);
  if (!confessionData) return false;

  const config = await getConfessionConfig(guildId);
  config.bannedHashes = config.bannedHashes.filter(h => h !== confessionData.userHash);
  await setConfessionConfig(guildId, { bannedHashes: config.bannedHashes });
  return true;
}

/**
 * Check if text contains blacklisted words
 */
export function checkBlacklist(text: string, blacklist: string[]): boolean {
  if (blacklist.length === 0) return false;
  const lowerText = text.toLowerCase();
  return blacklist.some(word => lowerText.includes(word.toLowerCase()));
}

/**
 * Store confession in Redis
 */
export async function storeConfession(
  guildId: string,
  number: number,
  userHash: string,
  content: string,
  userId?: string,
  imageUrl?: string
): Promise<void> {
  const data: Record<string, string> = {
    userHash,
    content,
    timestamp: Date.now().toString(),
    imageUrl: imageUrl || '',
  };

  // Only store userId if not in full anonymity mode
  const config = await getConfessionConfig(guildId);
  if (!config.fullAnonymity && userId) {
    data.userId = userId;
  }

  cache.hset(`confession:${guildId}:${number}`, data);
  cache.expire(`confession:${guildId}:${number}`, 86400 * 365);
}

/**
 * Get stored confession data
 */
export async function getConfessionData(
  guildId: string,
  number: number
): Promise<{
  userHash: string;
  userId?: string;
  content: string;
  timestamp: number;
  imageUrl?: string;
} | null> {
  const data = cache.hgetall(`confession:${guildId}:${number}`);
  if (!data || Object.keys(data).length === 0) return null;

  return {
    userHash: data.userHash,
    userId: data.userId,
    content: data.content,
    timestamp: parseInt(data.timestamp, 10),
    imageUrl: data.imageUrl || undefined,
  };
}

/**
 * Build container for posting confession
 */
export function buildConfessionContainer(number: number, content: string, config: ConfessionConfig): ContainerBuilder {
  const container = moduleContainer('confessions');
  addText(container, `### Confession #${number}\n${content}`);
  return container;
}

/**
 * Build container for moderation queue
 */
export function buildModerationContainer(number: number, content: string, config: ConfessionConfig): ContainerBuilder {
  const container = moduleContainer('confessions');
  addText(container, `### Pending Confession #${number}\n${content}\n\n-# Awaiting Moderation`);
  return container;
}

/**
 * Build action row with Submit + Respond buttons for confession embeds.
 */
export function buildConfessionButtons(confessionNumber: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`confession_submit_new`)
        .setLabel('Submit Confession')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`confession_respond_${confessionNumber}`)
        .setLabel('Respond')
        .setEmoji('💬')
        .setStyle(ButtonStyle.Secondary),
    );
}

/**
 * Store pending confession for moderation
 */
export async function storePendingConfession(
  guildId: string,
  number: number,
  userHash: string,
  content: string,
  userId?: string,
  imageUrl?: string
): Promise<void> {
  const data: Record<string, string> = {
    userHash,
    content,
    timestamp: Date.now().toString(),
    imageUrl: imageUrl || '',
  };

  const config = await getConfessionConfig(guildId);
  if (!config.fullAnonymity && userId) {
    data.userId = userId;
  }

  cache.hset(`confession_pending:${guildId}:${number}`, data);
  cache.expire(`confession_pending:${guildId}:${number}`, 86400 * 7);
}

/**
 * Get pending confession data
 */
export async function getPendingConfessionData(
  guildId: string,
  number: number
): Promise<{
  userHash: string;
  userId?: string;
  content: string;
  timestamp: number;
  imageUrl?: string;
} | null> {
  const data = cache.hgetall(`confession_pending:${guildId}:${number}`);
  if (!data || Object.keys(data).length === 0) return null;

  return {
    userHash: data.userHash,
    userId: data.userId,
    content: data.content,
    timestamp: parseInt(data.timestamp, 10),
    imageUrl: data.imageUrl || undefined,
  };
}

/**
 * Remove pending confession
 */
export async function removePendingConfession(guildId: string, number: number): Promise<void> {
  cache.del(`confession_pending:${guildId}:${number}`);
}

/**
 * Check cooldown for user
 */
export async function checkCooldown(guildId: string, userId: string): Promise<number | null> {
  const key = `confess:cd:${guildId}:${userId}`;
  const exists = cache.has(key);
  return exists ? 1 : null;
}

/**
 * Set cooldown for user
 */
export async function setCooldown(guildId: string, userId: string, seconds: number): Promise<void> {
  cache.set(`confess:cd:${guildId}:${userId}`, '1', seconds);
}
