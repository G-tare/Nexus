import {
  Guild,
  TextChannel,
  EmbedBuilder,
  Message,
} from 'discord.js';
import { getDb } from '../../Shared/src/database/connection';
import { getRedis } from '../../Shared/src/database/connection';
import { sql } from 'drizzle-orm';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Userphone');

// ============================================
// Config
// ============================================

export interface UserphoneConfig {
  /** Channels where userphone can be used (empty = any) */
  allowedChannels: string[];
  /** Blacklisted server IDs */
  blacklistedServers: string[];
  /** Max call duration in seconds (0 = unlimited) */
  maxDuration: number;
  /** Allow images/attachments in calls */
  allowAttachments: boolean;
  /** Show server name to the other side */
  showServerName: boolean;
  /** Cooldown between calls in seconds */
  callCooldown: number;
}

export async function getUserphoneConfig(guildId: string): Promise<UserphoneConfig> {
  const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'userphone');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
  return {
    allowedChannels: config?.allowedChannels ?? [],
    blacklistedServers: config?.blacklistedServers ?? [],
    maxDuration: config?.maxDuration ?? 300, // 5 minutes
    allowAttachments: config?.allowAttachments ?? true,
    showServerName: config?.showServerName ?? true,
    callCooldown: config?.callCooldown ?? 30,
  };
}

// ============================================
// Active Call State
// ============================================

export interface ActiveCall {
  callId: string;
  side1: { guildId: string; channelId: string; guildName: string };
  side2: { guildId: string; channelId: string; guildName: string };
  startedAt: number;
  maxDuration: number;
}

/**
 * Get the active call for a channel.
 */
export async function getActiveCall(channelId: string): Promise<ActiveCall | null> {
  const redis = getRedis();
  const callId = await redis.get(`userphone:channel:${channelId}`);
  if (!callId) return null;

  const data = await redis.get(`userphone:call:${callId}`);
  if (!data) return null;

  try {
    return JSON.parse(data) as ActiveCall;
  } catch {
    return null;
  }
}

/**
 * Get the other side's channel ID for an active call.
 */
export function getOtherSide(call: ActiveCall, myChannelId: string): { guildId: string; channelId: string; guildName: string } | null {
  if (call.side1.channelId === myChannelId) return call.side2;
  if (call.side2.channelId === myChannelId) return call.side1;
  return null;
}

// ============================================
// Call Queue
// ============================================

interface QueueEntry {
  guildId: string;
  channelId: string;
  guildName: string;
  queuedAt: number;
}

/**
 * Add a channel to the call queue.
 */
export async function joinQueue(guildId: string, channelId: string, guildName: string): Promise<void> {
  const redis = getRedis();
  const entry: QueueEntry = { guildId, channelId, guildName, queuedAt: Date.now() };
  await redis.setex(`userphone:queue:${channelId}`, 120, JSON.stringify(entry));
  await redis.sadd('userphone:queue', channelId);
}

/**
 * Remove a channel from the queue.
 */
export async function leaveQueue(channelId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`userphone:queue:${channelId}`);
  await redis.srem('userphone:queue', channelId);
}

/**
 * Find a match in the queue (not from the same guild, not blacklisted).
 */
export async function findMatch(guildId: string, channelId: string): Promise<QueueEntry | null> {
  const redis = getRedis();
  const config = await getUserphoneConfig(guildId);
  const members = await redis.smembers('userphone:queue');

  for (const queuedChannelId of members) {
    if (queuedChannelId === channelId) continue;

    const data = await redis.get(`userphone:queue:${queuedChannelId}`);
    if (!data) {
      await redis.srem('userphone:queue', queuedChannelId);
      continue;
    }

    try {
      const entry = JSON.parse(data) as QueueEntry;

      // Don't match with same guild
      if (entry.guildId === guildId) continue;

      // Check if either side has blacklisted the other
      if (config.blacklistedServers.includes(entry.guildId)) continue;

      const otherConfig = await getUserphoneConfig(entry.guildId);
      if (otherConfig.blacklistedServers.includes(guildId)) continue;

      return entry;
    } catch {
      await redis.srem('userphone:queue', queuedChannelId);
    }
  }

  return null;
}

// ============================================
// Call Lifecycle
// ============================================

/**
 * Start a call between two channels.
 */
export async function startCall(
  side1: { guildId: string; channelId: string; guildName: string },
  side2: { guildId: string; channelId: string; guildName: string },
): Promise<ActiveCall> {
  const redis = getRedis();
  const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const config1 = await getUserphoneConfig(side1.guildId);
  const config2 = await getUserphoneConfig(side2.guildId);
  const maxDuration = Math.min(config1.maxDuration, config2.maxDuration) || 300;

  const call: ActiveCall = {
    callId,
    side1,
    side2,
    startedAt: Date.now(),
    maxDuration,
  };

  // Store call data
  await redis.setex(`userphone:call:${callId}`, maxDuration + 60, JSON.stringify(call));
  await redis.setex(`userphone:channel:${side1.channelId}`, maxDuration + 60, callId);
  await redis.setex(`userphone:channel:${side2.channelId}`, maxDuration + 60, callId);

  // Remove both from queue
  await leaveQueue(side1.channelId);
  await leaveQueue(side2.channelId);

  logger.info('Call started', { callId, side1: side1.guildId, side2: side2.guildId });
  eventBus.emit('userphoneCallStarted', {
    guildId1: side1.guildId,
    guildId2: side2.guildId,
    channelId1: side1.channelId,
    channelId2: side2.channelId,
    callId,
    side1: side1.guildId,
    side2: side2.guildId,
  });

  return call;
}

/**
 * End an active call.
 */
export async function endCall(callId: string): Promise<ActiveCall | null> {
  const redis = getRedis();
  const data = await redis.get(`userphone:call:${callId}`);
  if (!data) return null;

  let call: ActiveCall;
  try {
    call = JSON.parse(data);
  } catch {
    return null;
  }

  // Clean up Redis
  await redis.del(`userphone:call:${callId}`);
  await redis.del(`userphone:channel:${call.side1.channelId}`);
  await redis.del(`userphone:channel:${call.side2.channelId}`);

  // Save to history
  const duration = Math.floor((Date.now() - call.startedAt) / 1000);
  const db = getDb();
  await db.execute(sql`
    INSERT INTO userphone_history (call_id, guild1_id, channel1_id, guild2_id, channel2_id, started_at, duration)
    VALUES (${callId}, ${call.side1.guildId}, ${call.side1.channelId}, ${call.side2.guildId}, ${call.side2.channelId}, ${call.startedAt}, ${duration})
  `);

  // Update stats
  await redis.hincrby(`userphone:stats:${call.side1.guildId}`, 'calls', 1);
  await redis.hincrby(`userphone:stats:${call.side1.guildId}`, 'totalDuration', duration);
  await redis.hincrby(`userphone:stats:${call.side2.guildId}`, 'calls', 1);
  await redis.hincrby(`userphone:stats:${call.side2.guildId}`, 'totalDuration', duration);

  logger.info('Call ended', { callId, duration });
  eventBus.emit('userphoneCallEnded', {
    guildId1: call.side1.guildId,
    guildId2: call.side2.guildId,
    reason: 'ended',
    callId,
    duration,
  });

  return call;
}

// ============================================
// Message Relay
// ============================================

/**
 * Relay a message to the other side of a call.
 */
export async function relayMessage(
  message: Message,
  call: ActiveCall,
  targetChannel: TextChannel,
  showServerName: boolean,
): Promise<void> {
  const config = await getUserphoneConfig(message.guild!.id);

  const senderName = showServerName
    ? `${message.author.displayName} (${message.guild!.name})`
    : message.author.displayName;

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setAuthor({
      name: `📞 ${senderName}`,
      iconURL: message.author.displayAvatarURL(),
    })
    .setDescription(message.content || '*No text*')
    .setTimestamp();

  // Relay attachments if allowed
  const files: Array<{ attachment: string; name: string }> = [];
  if (config.allowAttachments && message.attachments.size > 0) {
    const firstAttachment = message.attachments.first();
    if (firstAttachment && firstAttachment.size < 8_000_000) { // 8MB limit
      // Show image in embed if it's an image
      if (firstAttachment.contentType?.startsWith('image/')) {
        embed.setImage(firstAttachment.url);
      } else {
        files.push({ attachment: firstAttachment.url, name: firstAttachment.name || 'attachment' });
      }
    }
  }

  await (targetChannel as any).send({ embeds: [embed], files }).catch((err: any) => {
    logger.error('Failed to relay message', { error: err.message });
  });

  // Increment message count
  const redis = getRedis();
  await redis.hincrby(`userphone:stats:${message.guild!.id}`, 'messages', 1);
}

// ============================================
// Stats & History
// ============================================

export interface UserphoneStats {
  totalCalls: number;
  totalMessages: number;
  totalDuration: number;
}

export async function getGuildStats(guildId: string): Promise<UserphoneStats> {
  const redis = getRedis();
  const calls = parseInt(await redis.hget(`userphone:stats:${guildId}`, 'calls') || '0', 10);
  const messages = parseInt(await redis.hget(`userphone:stats:${guildId}`, 'messages') || '0', 10);
  const totalDuration = parseInt(await redis.hget(`userphone:stats:${guildId}`, 'totalDuration') || '0', 10);

  return { totalCalls: calls, totalMessages: messages, totalDuration };
}

export interface CallHistoryEntry {
  callId: string;
  otherGuildId: string;
  startedAt: number;
  duration: number;
}

export async function getCallHistory(guildId: string, limit: number = 10): Promise<CallHistoryEntry[]> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT call_id, guild1_id, guild2_id, started_at, duration
    FROM userphone_history
    WHERE guild1_id = ${guildId} OR guild2_id = ${guildId}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `);

  return ((result as any).rows || []).map((row: any) => ({
    callId: row.call_id,
    otherGuildId: row.guild1_id === guildId ? row.guild2_id : row.guild1_id,
    startedAt: row.started_at,
    duration: row.duration,
  }));
}

// ============================================
// Cooldowns
// ============================================

export async function isOnCallCooldown(guildId: string, channelId: string): Promise<boolean> {
  const redis = getRedis();
  return (await redis.exists(`userphone:cooldown:${channelId}`)) === 1;
}

export async function setCallCooldown(guildId: string, channelId: string): Promise<void> {
  const redis = getRedis();
  const config = await getUserphoneConfig(guildId);
  await redis.setex(`userphone:cooldown:${channelId}`, config.callCooldown, '1');
}

/**
 * Format seconds to a readable duration.
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}
