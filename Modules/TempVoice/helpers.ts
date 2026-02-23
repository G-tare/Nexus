import {
  VoiceChannel,
  Guild,
  User,
  PermissionFlagsBits,
  ChannelType,
  Collection,
} from 'discord.js';
import { createModuleLogger } from '../../Shared/src/utils/logger';
const logger = createModuleLogger('TempVoice');

export interface TempVCConfig {
  enabled: boolean;
  creatorChannelId: string | null;
  categoryId: string | null;
  maxVCs: number;
  cooldownSeconds: number;
  defaultUserLimit: number;
  deleteAfterEmpty: number;
  inactivityTimeout: number;
  bannedUsers: string[];
  nameTemplate: string;
  bitrate: number;
}

export interface TempVCRecord {
  id: string;
  guildId: string;
  channelId: string;
  ownerId: string;
  createdAt: Date;
  lockedBy?: string[];
  permittedUsers?: string[];
  deniedUsers?: string[];
}

export const DEFAULT_CONFIG: TempVCConfig = {
  enabled: true,
  creatorChannelId: null,
  categoryId: null,
  maxVCs: 10,
  cooldownSeconds: 30,
  defaultUserLimit: 0,
  deleteAfterEmpty: 60,
  inactivityTimeout: 0,
  bannedUsers: [],
  nameTemplate: "{user}'s Channel",
  bitrate: 64000,
};

// In-memory storage for temp VCs (would be replaced with actual DB)
const tempVCDatabase = new Map<string, TempVCRecord>();
const userCooldowns = new Map<string, number>();
const deletionSchedules = new Map<string, NodeJS.Timeout>();
const inactivityTimers = new Map<string, NodeJS.Timeout>();

/**
 * Get module configuration for a guild
 */
export async function getConfig(
  guild: Guild
): Promise<TempVCConfig> {
  try {
    // In production, fetch from database via guild's module config
    // For now, return stored config or default
    const stored = (guild as any).__tempVCConfig;
    return stored || { ...DEFAULT_CONFIG };
  } catch (error) {
    logger.error('[TempVoice] Error getting config:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save module configuration for a guild
 */
export async function saveConfig(
  guild: Guild,
  config: Partial<TempVCConfig>
): Promise<void> {
  try {
    const current = await getConfig(guild);
    const updated = { ...current, ...config };
    (guild as any).__tempVCConfig = updated;
    logger.info('[TempVoice] Config saved for guild:', guild.id);
  } catch (error) {
    logger.error('[TempVoice] Error saving config:', error);
    throw error;
  }
}

/**
 * Create a new temp VC record in database
 */
export async function createTempVC(record: TempVCRecord): Promise<void> {
  try {
    tempVCDatabase.set(record.id, { ...record });
    logger.info('[TempVoice] Created temp VC record:', record.id);
  } catch (error) {
    logger.error('[TempVoice] Error creating temp VC:', error);
    throw error;
  }
}

/**
 * Get temp VC record by channel ID
 */
export async function getTempVCByChannelId(
  channelId: string
): Promise<TempVCRecord | null> {
  try {
    for (const [, record] of tempVCDatabase) {
      if (record.channelId === channelId) {
        return record;
      }
    }
    return null;
  } catch (error) {
    logger.error('[TempVoice] Error getting temp VC:', error);
    return null;
  }
}

/**
 * Get temp VC record by owner ID in a guild
 */
export async function getUserTempVC(
  guildId: string,
  userId: string
): Promise<TempVCRecord | null> {
  try {
    for (const [, record] of tempVCDatabase) {
      if (record.guildId === guildId && record.ownerId === userId) {
        return record;
      }
    }
    return null;
  } catch (error) {
    logger.error('[TempVoice] Error getting user temp VC:', error);
    return null;
  }
}

/**
 * Get all temp VCs in a guild
 */
export async function getGuildTempVCs(guildId: string): Promise<TempVCRecord[]> {
  try {
    const results: TempVCRecord[] = [];
    for (const [, record] of tempVCDatabase) {
      if (record.guildId === guildId) {
        results.push(record);
      }
    }
    return results;
  } catch (error) {
    logger.error('[TempVoice] Error getting guild temp VCs:', error);
    return [];
  }
}

/**
 * Delete temp VC record
 */
export async function deleteTempVC(channelId: string): Promise<void> {
  try {
    for (const [key, record] of tempVCDatabase) {
      if (record.channelId === channelId) {
        tempVCDatabase.delete(key);
        logger.info('[TempVoice] Deleted temp VC record:', channelId);
        break;
      }
    }
  } catch (error) {
    logger.error('[TempVoice] Error deleting temp VC:', error);
    throw error;
  }
}

/**
 * Update temp VC record
 */
export async function updateTempVC(
  channelId: string,
  updates: Partial<TempVCRecord>
): Promise<TempVCRecord | null> {
  try {
    for (const [key, record] of tempVCDatabase) {
      if (record.channelId === channelId) {
        const updated = { ...record, ...updates };
        tempVCDatabase.set(key, updated);
        logger.info('[TempVoice] Updated temp VC record:', channelId);
        return updated;
      }
    }
    return null;
  } catch (error) {
    logger.error('[TempVoice] Error updating temp VC:', error);
    throw error;
  }
}

/**
 * Check if user is on cooldown
 */
export function isOnCooldown(userId: string): boolean {
  const cooldownTime = userCooldowns.get(userId);
  if (!cooldownTime) return false;
  return Date.now() < cooldownTime;
}

/**
 * Get remaining cooldown time in seconds
 */
export function getCooldownRemaining(userId: string): number {
  const cooldownTime = userCooldowns.get(userId);
  if (!cooldownTime) return 0;
  const remaining = Math.ceil((cooldownTime - Date.now()) / 1000);
  return Math.max(0, remaining);
}

/**
 * Set cooldown for user
 */
export function setCooldown(userId: string, seconds: number): void {
  userCooldowns.set(userId, Date.now() + seconds * 1000);
}

/**
 * Clear user cooldown
 */
export function clearCooldown(userId: string): void {
  userCooldowns.delete(userId);
}

/**
 * Schedule channel deletion after timeout
 */
export function scheduleDeletion(
  channelId: string,
  delayMs: number,
  onDelete: () => Promise<void>
): void {
  // Cancel any existing deletion schedule
  cancelDeletion(channelId);

  const timeout = setTimeout(async () => {
    try {
      await onDelete();
    } catch (error) {
      logger.error('[TempVoice] Error during scheduled deletion:', error);
    } finally {
      deletionSchedules.delete(channelId);
    }
  }, delayMs);

  deletionSchedules.set(channelId, timeout);
}

/**
 * Cancel scheduled deletion
 */
export function cancelDeletion(channelId: string): void {
  const timeout = deletionSchedules.get(channelId);
  if (timeout) {
    clearTimeout(timeout);
    deletionSchedules.delete(channelId);
  }
}

/**
 * Schedule inactivity timeout
 */
export function scheduleInactivityTimeout(
  channelId: string,
  delayMs: number,
  onTimeout: () => Promise<void>
): void {
  // Cancel any existing inactivity timer
  cancelInactivityTimeout(channelId);

  const timeout = setTimeout(async () => {
    try {
      await onTimeout();
    } catch (error) {
      logger.error('[TempVoice] Error during inactivity timeout:', error);
    } finally {
      inactivityTimers.delete(channelId);
    }
  }, delayMs);

  inactivityTimers.set(channelId, timeout);
}

/**
 * Cancel inactivity timeout
 */
export function cancelInactivityTimeout(channelId: string): void {
  const timeout = inactivityTimers.get(channelId);
  if (timeout) {
    clearTimeout(timeout);
    inactivityTimers.delete(channelId);
  }
}

/**
 * Check if user is banned from creating temp VCs
 */
export async function isUserBanned(
  guild: Guild,
  userId: string
): Promise<boolean> {
  try {
    const config = await getConfig(guild);
    return config.bannedUsers.includes(userId);
  } catch (error) {
    logger.error('[TempVoice] Error checking ban status:', error);
    return false;
  }
}

/**
 * Ban user from creating temp VCs
 */
export async function banUser(guild: Guild, userId: string): Promise<void> {
  try {
    const config = await getConfig(guild);
    if (!config.bannedUsers.includes(userId)) {
      config.bannedUsers.push(userId);
      await saveConfig(guild, { bannedUsers: config.bannedUsers });
      logger.info('[TempVoice] Banned user:', userId);
    }
  } catch (error) {
    logger.error('[TempVoice] Error banning user:', error);
    throw error;
  }
}

/**
 * Unban user from creating temp VCs
 */
export async function unbanUser(guild: Guild, userId: string): Promise<void> {
  try {
    const config = await getConfig(guild);
    config.bannedUsers = config.bannedUsers.filter((id) => id !== userId);
    await saveConfig(guild, { bannedUsers: config.bannedUsers });
    logger.info('[TempVoice] Unbanned user:', userId);
  } catch (error) {
    logger.error('[TempVoice] Error unbanning user:', error);
    throw error;
  }
}

/**
 * Format channel name from template
 */
export function formatChannelName(
  template: string,
  user: User | { username: string }
): string {
  return template.replace('{user}', user.username);
}

/**
 * Set channel permissions for locking
 */
export async function lockChannel(channel: VoiceChannel): Promise<void> {
  try {
    await (channel as any).permissionOverwrites.set([
      {
        id: channel.guild.roles.everyone,
        deny: [PermissionFlagsBits.Connect],
      },
    ]);
    logger.info('[TempVoice] Locked channel:', channel.id);
  } catch (error) {
    logger.error('[TempVoice] Error locking channel:', error);
    throw error;
  }
}

/**
 * Unlock channel (restore default permissions)
 */
export async function unlockChannel(channel: VoiceChannel): Promise<void> {
  try {
    const existing = Array.from((channel as any).permissionOverwrites.cache.values());
    const toRemove = existing.filter(
      (ow) =>
        (ow as any).id === channel.guild.roles.everyone.id &&
        (ow as any).deny.has(PermissionFlagsBits.Connect)
    );

    for (const ow of toRemove) {
      await (channel as any).permissionOverwrites.delete((ow as any).id);
    }
    logger.info('[TempVoice] Unlocked channel:', channel.id);
  } catch (error) {
    logger.error('[TempVoice] Error unlocking channel:', error);
    throw error;
  }
}

/**
 * Permit a specific user to join locked channel
 */
export async function permitUser(
  channel: VoiceChannel,
  userId: string
): Promise<void> {
  try {
    await (channel as any).permissionOverwrites.edit(userId, {
      Connect: true,
    });
    logger.info('[TempVoice] Permitted user:', userId, 'channel:', channel.id);
  } catch (error) {
    logger.error('[TempVoice] Error permitting user:', error);
    throw error;
  }
}

/**
 * Deny a specific user from joining
 */
export async function denyUser(
  channel: VoiceChannel,
  userId: string
): Promise<void> {
  try {
    await (channel as any).permissionOverwrites.edit(userId, {
      Connect: false,
    });
    logger.info('[TempVoice] Denied user:', userId, 'channel:', channel.id);
  } catch (error) {
    logger.error('[TempVoice] Error denying user:', error);
    throw error;
  }
}

/**
 * Remove permission override for user
 */
export async function removeDeny(
  channel: VoiceChannel,
  userId: string
): Promise<void> {
  try {
    await (channel as any).permissionOverwrites.delete(userId);
    logger.info('[TempVoice] Removed deny for user:', userId, 'channel:', channel.id);
  } catch (error) {
    logger.error('[TempVoice] Error removing deny:', error);
    throw error;
  }
}

/**
 * Log audit event
 */
export async function auditLog(
  guild: Guild,
  action: string,
  targetId: string,
  userId: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    logger.info('[TempVoice] Audit:', {
      action,
      guild: guild.id,
      target: targetId,
      user: userId,
      ...details,
    });
    // In production, emit to auditLog event system
  } catch (error) {
    logger.error('[TempVoice] Error logging audit:', error);
  }
}
