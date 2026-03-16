import {
  Guild,
  TextChannel,
  Message,
} from 'discord.js';
import { getDb, getPool } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { sql } from 'drizzle-orm';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { moduleContainer, addText, addSectionWithThumbnail, v2Payload } from '../../Shared/src/utils/componentsV2';

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
  /** Content filter — what to block from incoming messages */
  contentFilter: {
    blockNSFW: boolean;
    blockProfanity: boolean;
    blockLinks: boolean;
    customBlockedWords: string[];
  };
  /** Channel where reports are sent for staff review */
  reportChannelId: string | null;
  /** How this server RECEIVES cross-server messages: 'embed' (default) or 'plain' */
  messageFormat: 'embed' | 'plain';
}

export async function getUserphoneConfig(guildId: string): Promise<UserphoneConfig> {
  const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'userphone');
  const config = (_cfgResult?.config ?? {}) as Record<string, any>;
  return {
    allowedChannels: config?.allowedChannels ?? [],
    blacklistedServers: config?.blacklistedServers ?? [],
    maxDuration: config?.maxDuration ?? 300,
    allowAttachments: config?.allowAttachments ?? true,
    showServerName: config?.showServerName ?? true,
    callCooldown: config?.callCooldown ?? 30,
    contentFilter: {
      blockNSFW: config?.contentFilter?.blockNSFW ?? false,
      blockProfanity: config?.contentFilter?.blockProfanity ?? false,
      blockLinks: config?.contentFilter?.blockLinks ?? false,
      customBlockedWords: config?.contentFilter?.customBlockedWords ?? [],
    },
    reportChannelId: config?.reportChannelId ?? null,
    messageFormat: config?.messageFormat === 'plain' ? 'plain' : 'embed',
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
  // Using global cache;
  const callId = cache.get<string>(`userphone:channel:${channelId}`);
  if (!callId) return null;

  const data = cache.get<string>(`userphone:call:${callId}`);
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
  // Using global cache;
  const entry: QueueEntry = { guildId, channelId, guildName, queuedAt: Date.now() };
  cache.set(`userphone:queue:${channelId}`, JSON.stringify(entry), 120);
  cache.sadd('userphone:queue', channelId);
}

/**
 * Remove a channel from the queue.
 */
export async function leaveQueue(channelId: string): Promise<void> {
  // Using global cache;
  cache.del(`userphone:queue:${channelId}`);
  cache.srem('userphone:queue', channelId);
}

/**
 * Find a match in the queue (not from the same guild, not blacklisted).
 */
export async function findMatch(guildId: string, channelId: string): Promise<QueueEntry | null> {
  // Using global cache;
  const config = await getUserphoneConfig(guildId);
  const members = cache.smembers('userphone:queue');

  for (const queuedChannelId of members) {
    if (queuedChannelId === channelId) continue;

    const data = cache.get<string>(`userphone:queue:${queuedChannelId}`);
    if (!data) {
      cache.srem('userphone:queue', queuedChannelId);
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

      // Check if either server is banned from userphone (bot owner ban)
      const myBanned = await isServerBanned(guildId);
      if (myBanned) continue;
      const theirBanned = await isServerBanned(entry.guildId);
      if (theirBanned) continue;

      return entry;
    } catch {
      cache.srem('userphone:queue', queuedChannelId);
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
  // Using global cache;
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
  cache.set(`userphone:call:${callId}`, JSON.stringify(call), maxDuration + 60);
  cache.set(`userphone:channel:${side1.channelId}`, callId, maxDuration + 60);
  cache.set(`userphone:channel:${side2.channelId}`, callId, maxDuration + 60);

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
  // Using global cache;
  const data = cache.get<string>(`userphone:call:${callId}`);
  if (!data) return null;

  let call: ActiveCall;
  try {
    call = JSON.parse(data);
  } catch {
    return null;
  }

  // Clean up Redis
  cache.del(`userphone:call:${callId}`);
  cache.del(`userphone:channel:${call.side1.channelId}`);
  cache.del(`userphone:channel:${call.side2.channelId}`);

  // Save to history
  const duration = Math.floor((Date.now() - call.startedAt) / 1000);
  const db = getDb();
  await db.execute(sql`
    INSERT INTO userphone_history (call_id, guild1_id, channel1_id, guild2_id, channel2_id, started_at, duration)
    VALUES (${callId}, ${call.side1.guildId}, ${call.side1.channelId}, ${call.side2.guildId}, ${call.side2.channelId}, ${call.startedAt}, ${duration})
  `);

  // Update stats
  const calls1 = cache.hget(`userphone:stats:${call.side1.guildId}`, 'calls') || '0';
  cache.hset(`userphone:stats:${call.side1.guildId}`, 'calls', String(parseInt(calls1, 10) + 1));
  const duration1 = cache.hget(`userphone:stats:${call.side1.guildId}`, 'totalDuration') || '0';
  cache.hset(`userphone:stats:${call.side1.guildId}`, 'totalDuration', String(parseInt(duration1, 10) + duration));
  const calls2 = cache.hget(`userphone:stats:${call.side2.guildId}`, 'calls') || '0';
  cache.hset(`userphone:stats:${call.side2.guildId}`, 'calls', String(parseInt(calls2, 10) + 1));
  const duration2 = cache.hget(`userphone:stats:${call.side2.guildId}`, 'totalDuration') || '0';
  cache.hset(`userphone:stats:${call.side2.guildId}`, 'totalDuration', String(parseInt(duration2, 10) + duration));

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

/**
 * Extend the call duration by resetting startedAt and refreshing TTLs.
 */
export async function extendCall(callId: string): Promise<boolean> {
  // Using global cache;
  const data = cache.get<string>(`userphone:call:${callId}`);
  if (!data) return false;

  let call: ActiveCall;
  try {
    call = JSON.parse(data);
  } catch {
    return false;
  }

  // Reset the timer by updating startedAt
  call.startedAt = Date.now();
  const ttl = call.maxDuration + 60;
  cache.set(`userphone:call:${callId}`, JSON.stringify(call), ttl);
  cache.expire(`userphone:channel:${call.side1.channelId}`, ttl);
  cache.expire(`userphone:channel:${call.side2.channelId}`, ttl);

  return true;
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
  // Check if the sender is user-banned — silently drop their messages
  const userBan = await isUserBanned(message.author.id);
  if (userBan.banned) return;

  const senderConfig = await getUserphoneConfig(message.guild!.id);
  const receiverGuildId = targetChannel.guild.id;
  const receiverConfig = await getUserphoneConfig(receiverGuildId);

  const hasText = message.content.trim().length > 0;
  const hasAttachments = message.attachments.size > 0;

  // If the message is ONLY an attachment and attachments are disabled, don't relay at all
  if (!hasText && hasAttachments && !senderConfig.allowAttachments) {
    return;
  }

  // If there's no text and no attachments, nothing to relay
  if (!hasText && !hasAttachments) {
    return;
  }

  // Record to transcript before any filtering
  await recordTranscriptMessage(call.callId, message);

  // Apply content filter from the RECEIVING guild's perspective
  if (hasText) {
    const filterResult = filterContent(message.content, receiverConfig);
    if (filterResult.blocked) {
      // Silently skip the message — don't notify the sender to avoid revealing filter config
      return;
    }
  }

  const senderName = showServerName
    ? `${message.author.displayName} (${message.guild!.name})`
    : message.author.displayName;

  // Relay attachments if allowed
  const files: Array<{ attachment: string; name: string }> = [];
  if (senderConfig.allowAttachments && hasAttachments) {
    const firstAttachment = message.attachments.first();
    if (firstAttachment && firstAttachment.size < 8_000_000) { // 8MB limit
      if (firstAttachment.contentType?.startsWith('image/')) {
        // Images handled differently per format below
      } else {
        files.push({ attachment: firstAttachment.url, name: firstAttachment.name || 'attachment' });
      }
    }
  }

  // Receiver decides how messages appear to them
  if (receiverConfig.messageFormat === 'plain') {
    // Plain text format — no container
    let plainContent = `📞 **${senderName}:** ${message.content || ''}`;

    // Attach image as a file in plain mode
    if (senderConfig.allowAttachments && hasAttachments) {
      const firstAttachment = message.attachments.first();
      if (firstAttachment && firstAttachment.size < 8_000_000 && firstAttachment.contentType?.startsWith('image/')) {
        files.push({ attachment: firstAttachment.url, name: firstAttachment.name || 'image.png' });
      }
    }

    await (targetChannel as any).send({ content: plainContent.trim(), files }).catch((err: any) => {
      logger.error('Failed to relay message (plain)', { error: err.message });
    });
  } else {
    // Container format (default)
    const container = moduleContainer('userphone');
    const messageText = hasText ? message.content : '';
    addSectionWithThumbnail(container, `**📞 ${senderName}**\n${messageText}`, message.author.displayAvatarURL());

    if (senderConfig.allowAttachments && hasAttachments) {
      const firstAttachment = message.attachments.first();
      if (firstAttachment && firstAttachment.size < 8_000_000 && firstAttachment.contentType?.startsWith('image/')) {
        files.push({ attachment: firstAttachment.url, name: firstAttachment.name || 'image.png' });
      }
    }

    await (targetChannel as any).send({ ...v2Payload([container]), files }).catch((err: any) => {
      logger.error('Failed to relay message', { error: err.message });
    });
  }

  // Increment message count
  // Using global cache;
  const messages = cache.hget(`userphone:stats:${message.guild!.id}`, 'messages') || '0';
  cache.hset(`userphone:stats:${message.guild!.id}`, 'messages', String(parseInt(messages, 10) + 1));
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
  // Using global cache;
  const calls = parseInt(cache.hget(`userphone:stats:${guildId}`, 'calls') || '0', 10);
  const messages = parseInt(cache.hget(`userphone:stats:${guildId}`, 'messages') || '0', 10);
  const totalDuration = parseInt(cache.hget(`userphone:stats:${guildId}`, 'totalDuration') || '0', 10);

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
  // Using global cache;
  return cache.has(`userphone:cooldown:${channelId}`);
}

export async function setCallCooldown(guildId: string, channelId: string): Promise<void> {
  // Using global cache;
  const config = await getUserphoneConfig(guildId);
  cache.set(`userphone:cooldown:${channelId}`, '1', config.callCooldown);
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

// ============================================
// Transcript Collection
// ============================================

export interface TranscriptMessage {
  author: string;
  authorId: string;
  guildName: string;
  guildId: string;
  content: string;
  timestamp: number;
  hasAttachment: boolean;
}

/**
 * Record a message in the call transcript (stored in Redis during the call).
 */
export async function recordTranscriptMessage(
  callId: string,
  message: Message,
): Promise<void> {
  // Using global cache;
  const entry: TranscriptMessage = {
    author: message.author.displayName,
    authorId: message.author.id,
    guildName: message.guild?.name || 'Unknown',
    guildId: message.guild?.id || '0',
    content: message.content || '',
    timestamp: Date.now(),
    hasAttachment: message.attachments.size > 0,
  };
  // Store transcript messages as a list-like structure using sadd (we'll retrieve all)
  const key = `userphone:transcript:${callId}`;
  const transcriptData = cache.get<string>(key) || '[]';
  let messages: any[] = [];
  try {
    messages = JSON.parse(transcriptData);
  } catch {}
  messages.push(entry);
  cache.set(key, JSON.stringify(messages), 3600);
}

/**
 * Get the full transcript for a call.
 */
export async function getTranscript(callId: string): Promise<TranscriptMessage[]> {
  // Using global cache;
  const raw = cache.get<string>(`userphone:transcript:${callId}`);
  const messages: TranscriptMessage[] = [];
  if (!raw) return messages;

  try {
    const items = JSON.parse(raw);
    if (Array.isArray(items)) {
      return items as TranscriptMessage[];
    }
  } catch {
    // skip corrupt entries
  }
  return messages;
}

/**
 * Build a text-based transcript string from transcript messages.
 */
export function buildTranscriptText(messages: TranscriptMessage[]): string {
  if (messages.length === 0) return 'No messages recorded.';

  const lines: string[] = [];
  for (const msg of messages) {
    const time = new Date(msg.timestamp).toISOString().slice(11, 19);
    const attachment = msg.hasAttachment ? ' [attachment]' : '';
    const content = msg.content || (msg.hasAttachment ? '[attachment only]' : '[empty]');
    lines.push(`[${time}] ${msg.author} (${msg.guildName}): ${content}${attachment}`);
  }
  return lines.join('\n');
}

// ============================================
// Server Bans (Bot-Owner Level)
// ============================================

/**
 * Check if a server is banned from userphone (global ban by bot owner).
 */
export async function isServerBanned(guildId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT id FROM userphone_server_bans WHERE guild_id = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1',
    [guildId],
  );
  return (result.rows?.length ?? 0) > 0;
}

/**
 * Ban a server from userphone (bot owner action).
 */
export async function banServer(
  guildId: string,
  reason: string,
  bannedBy: string,
  reportId?: number,
  expiresAt?: Date,
): Promise<void> {
  const pool = getPool();
  // Deactivate any existing bans first
  await pool.query(
    'UPDATE userphone_server_bans SET is_active = false WHERE guild_id = $1 AND is_active = true',
    [guildId],
  );
  await pool.query(
    'INSERT INTO userphone_server_bans (guild_id, reason, banned_by, report_id, expires_at) VALUES ($1, $2, $3, $4, $5)',
    [guildId, reason, bannedBy, reportId || null, expiresAt || null],
  );
  logger.info('Server banned from userphone', { guildId, bannedBy, reason });
}

/**
 * Unban a server from userphone.
 */
export async function unbanServer(guildId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    'UPDATE userphone_server_bans SET is_active = false WHERE guild_id = $1 AND is_active = true',
    [guildId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================
// User-Level Bans (Bot-Owner Level)
// ============================================

/**
 * Temporarily ban a user from userphone. After 3 temp bans, auto-escalates to permanent.
 */
export async function tempBanUser(
  userId: string,
  durationSeconds: number,
  reason: string,
  bannedBy: string,
): Promise<{ permanent: boolean }> {
  // Using global cache;

  // Increment lifetime temp ban counter
  const banCountKey = `userphone:bancount:${userId}`;
  const banCount = cache.incr(banCountKey);

  const PERMANENT_BAN_THRESHOLD = 3;

  if (banCount >= PERMANENT_BAN_THRESHOLD) {
    // 3rd temp ban → permanent
    await permanentBanUser(userId, `Automatic: reached ${PERMANENT_BAN_THRESHOLD} temporary bans. Latest: ${reason}`, bannedBy);
    logger.warn('User PERMANENTLY banned from userphone (escalation)', { userId, banCount, reason });
    return { permanent: true };
  }

  cache.set(`userphone:userban:${userId}`, JSON.stringify({
    reason,
    bannedBy,
    bannedAt: Date.now(),
    expiresAt: Date.now() + (durationSeconds * 1000),
    banNumber: banCount,
  }), durationSeconds);

  logger.info('User temp-banned from userphone', { userId, durationSeconds, reason, banNumber: banCount });
  return { permanent: false };
}

/**
 * Permanently ban a user from userphone. Stored in both Redis (fast lookup) and DB (persistence).
 */
export async function permanentBanUser(userId: string, reason: string, bannedBy: string): Promise<void> {
  // Using global cache;

  // Cache for fast lookup
  cache.set(`userphone:permban:${userId}`, JSON.stringify({
    reason,
    bannedBy,
    bannedAt: Date.now(),
  }), 0);

  // DB for persistence across Redis flushes
  const pool = getPool();
  await pool.query(
    `INSERT INTO userphone_user_bans (user_id, reason, banned_by, banned_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET reason = $2, banned_by = $3, banned_at = NOW()`,
    [userId, reason, bannedBy],
  );

  logger.warn('User PERMANENTLY banned from userphone', { userId, reason, bannedBy });
}

/**
 * Check if a user is banned from userphone (temp or permanent).
 */
export async function isUserBanned(userId: string): Promise<{
  banned: boolean;
  permanent?: boolean;
  reason?: string;
  bannedBy?: string;
  expiresAt?: number;
  banNumber?: number;
}> {
  // Using global cache;

  // Check permanent ban first
  const permBan = cache.get<string>(`userphone:permban:${userId}`);
  if (permBan) {
    try {
      const ban = JSON.parse(permBan);
      return { banned: true, permanent: true, reason: ban.reason, bannedBy: ban.bannedBy };
    } catch {
      return { banned: true, permanent: true, reason: 'Permanently banned' };
    }
  }

  // Check temp ban
  const data = cache.get<string>(`userphone:userban:${userId}`);
  if (!data) return { banned: false };

  try {
    const ban = JSON.parse(data);
    return {
      banned: true,
      permanent: false,
      reason: ban.reason,
      bannedBy: ban.bannedBy,
      expiresAt: ban.expiresAt,
      banNumber: ban.banNumber,
    };
  } catch {
    return { banned: false };
  }
}

/**
 * Unban a user from userphone (removes temp, permanent, and resets counter).
 */
export async function unbanUser(userId: string): Promise<void> {
  // Using global cache;

  // Remove all Redis keys
  cache.del(`userphone:permban:${userId}`);
  cache.del(`userphone:userban:${userId}`);
  cache.del(`userphone:bancount:${userId}`);

  // Remove from DB permanent bans table
  const pool = getPool();
  await pool.query('DELETE FROM userphone_user_bans WHERE user_id = $1', [userId]);

  logger.info('User unbanned from userphone', { userId });
}

/**
 * Get the lifetime number of temp bans a user has received.
 */
export async function getTempBanCount(userId: string): Promise<number> {
  // Using global cache;
  const val = cache.get<string>(`userphone:bancount:${userId}`);
  return val ? parseInt(val, 10) : 0;
}

// ============================================
// Reports
// ============================================

export interface UserphoneReport {
  id: number;
  callId: string;
  reporterGuildId: string;
  reporterUserId: string;
  reportedGuildId: string;
  reason: string;
  transcript: string | null;
  status: string;
  staffNotes: string | null;
  createdAt: Date;
}

/**
 * Submit a userphone report. Saves the report with transcript to the database.
 * Returns the report ID.
 */
export async function submitReport(
  callId: string,
  reporterGuildId: string,
  reporterUserId: string,
  reportedGuildId: string,
  reason: string,
): Promise<number> {
  const pool = getPool();
  // Get transcript
  const transcript = await getTranscript(callId);
  const transcriptText = buildTranscriptText(transcript);

  const result = await pool.query(
    'INSERT INTO userphone_reports (call_id, reporter_guild_id, reporter_user_id, reported_guild_id, reason, transcript) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [callId, reporterGuildId, reporterUserId, reportedGuildId, reason, transcriptText],
  );

  const reportId = result.rows[0]?.id;
  logger.info('Userphone report submitted', { reportId, callId, reporterGuildId, reportedGuildId });
  return reportId;
}

/**
 * Get a report by ID.
 */
export async function getReport(reportId: number): Promise<UserphoneReport | null> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM userphone_reports WHERE id = $1',
    [reportId],
  );
  if (!result.rows || result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    callId: row.call_id,
    reporterGuildId: row.reporter_guild_id,
    reporterUserId: row.reporter_user_id,
    reportedGuildId: row.reported_guild_id,
    reason: row.reason,
    transcript: row.transcript,
    status: row.status,
    staffNotes: row.staff_notes,
    createdAt: row.created_at,
  };
}

/**
 * Add the reported server to the reporter's blacklist via config.
 */
export async function addToBlacklist(guildId: string, targetGuildId: string): Promise<void> {
  const config = await getUserphoneConfig(guildId);
  const list = [...config.blacklistedServers];
  if (!list.includes(targetGuildId)) {
    list.push(targetGuildId);
    await moduleConfig.updateConfig(guildId, 'userphone', { blacklistedServers: list });
  }
}

// ============================================
// Content Filter
// ============================================

// Basic profanity word list (can be extended via config)
const PROFANITY_LIST = [
  'fuck', 'shit', 'bitch', 'ass', 'dick', 'cunt', 'nigger', 'nigga',
  'faggot', 'retard', 'whore', 'slut',
];

// Basic NSFW keyword detection
const NSFW_KEYWORDS = [
  'nsfw', 'porn', 'hentai', 'xxx', 'nude', 'nudes', 'onlyfans',
  'r34', 'rule34', 'boobs', 'tits', 'pussy', 'cock',
];

const URL_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+|\w+\.\w{2,}\/[^\s]*/gi;

export interface ContentFilterResult {
  blocked: boolean;
  reason: string | null;
  filteredContent: string | null;
}

/**
 * Filter incoming message content based on the RECEIVING guild's content filter config.
 * Returns whether the message should be blocked and the reason.
 */
export function filterContent(
  content: string,
  receiverConfig: UserphoneConfig,
): ContentFilterResult {
  if (!content || content.trim().length === 0) {
    return { blocked: false, reason: null, filteredContent: null };
  }

  const filter = receiverConfig.contentFilter;
  const lowerContent = content.toLowerCase();

  // Check custom blocked words first (highest priority)
  if (filter.customBlockedWords.length > 0) {
    for (const word of filter.customBlockedWords) {
      if (lowerContent.includes(word.toLowerCase())) {
        return { blocked: true, reason: 'blocked word', filteredContent: null };
      }
    }
  }

  // Check NSFW
  if (filter.blockNSFW) {
    for (const keyword of NSFW_KEYWORDS) {
      if (lowerContent.includes(keyword)) {
        return { blocked: true, reason: 'NSFW content', filteredContent: null };
      }
    }
  }

  // Check profanity
  if (filter.blockProfanity) {
    for (const word of PROFANITY_LIST) {
      // Word boundary check (basic)
      const regex = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (regex.test(content)) {
        return { blocked: true, reason: 'profanity', filteredContent: null };
      }
    }
  }

  // Check links
  if (filter.blockLinks) {
    if (URL_REGEX.test(content)) {
      return { blocked: true, reason: 'links not allowed', filteredContent: null };
    }
  }

  return { blocked: false, reason: null, filteredContent: null };
}

/**
 * Store the last call info for a channel so users can report after a call ends.
 * Stored for 10 minutes after call end.
 */
export async function storeLastCallInfo(
  channelId: string,
  callId: string,
  otherGuildId: string,
  otherGuildName: string,
): Promise<void> {
  // Using global cache;
  const data = JSON.stringify({ callId, otherGuildId, otherGuildName });
  cache.set(`userphone:lastcall:${channelId}`, data, 600);
}

/**
 * Get last call info for a channel (for reporting after call ends).
 */
export async function getLastCallInfo(
  channelId: string,
): Promise<{ callId: string; otherGuildId: string; otherGuildName: string } | null> {
  // Using global cache;
  const data = cache.get<string>(`userphone:lastcall:${channelId}`);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// ============================================
// Contacts
// ============================================

export interface UserphoneContact {
  id: number;
  guildId: string;
  contactGuildId: string;
  contactGuildName: string;
  addedBy: string;
  addedAt: Date;
}

/**
 * Save a contact (mutual — saves for both guilds).
 */
export async function saveContact(
  guildId: string,
  guildName: string,
  contactGuildId: string,
  contactGuildName: string,
  addedBy: string,
): Promise<void> {
  const pool = getPool();
  // Save for both sides (upsert to avoid duplicates)
  await pool.query(
    'INSERT INTO userphone_contacts (guild_id, contact_guild_id, contact_guild_name, added_by) VALUES ($1, $2, $3, $4) ON CONFLICT (guild_id, contact_guild_id) DO UPDATE SET contact_guild_name = $3',
    [guildId, contactGuildId, contactGuildName, addedBy],
  );
  await pool.query(
    'INSERT INTO userphone_contacts (guild_id, contact_guild_id, contact_guild_name, added_by) VALUES ($1, $2, $3, $4) ON CONFLICT (guild_id, contact_guild_id) DO UPDATE SET contact_guild_name = $3',
    [contactGuildId, guildId, guildName, addedBy],
  );
  logger.info('Userphone contact saved', { guildId, contactGuildId });
}

/**
 * Remove a contact (mutual — removes for both guilds).
 */
export async function removeContact(
  guildId: string,
  contactGuildId: string,
): Promise<boolean> {
  const pool = getPool();
  const r1 = await pool.query(
    'DELETE FROM userphone_contacts WHERE guild_id = $1 AND contact_guild_id = $2',
    [guildId, contactGuildId],
  );
  await pool.query(
    'DELETE FROM userphone_contacts WHERE guild_id = $1 AND contact_guild_id = $2',
    [contactGuildId, guildId],
  );
  return (r1.rowCount ?? 0) > 0;
}

/**
 * Get all contacts for a guild.
 */
export async function getContacts(guildId: string): Promise<UserphoneContact[]> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM userphone_contacts WHERE guild_id = $1 ORDER BY added_at DESC',
    [guildId],
  );
  return (result.rows || []).map((row: any) => ({
    id: row.id,
    guildId: row.guild_id,
    contactGuildId: row.contact_guild_id,
    contactGuildName: row.contact_guild_name,
    addedBy: row.added_by,
    addedAt: row.added_at,
  }));
}

/**
 * Check if two guilds are contacts.
 */
export async function isContact(guildId: string, contactGuildId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT id FROM userphone_contacts WHERE guild_id = $1 AND contact_guild_id = $2 LIMIT 1',
    [guildId, contactGuildId],
  );
  return (result.rows?.length ?? 0) > 0;
}

/**
 * Store a pending contact request in Redis (expires in 5 min).
 * The other guild must accept before it's saved.
 */
export async function createContactRequest(
  requesterGuildId: string,
  requesterGuildName: string,
  requesterChannelId: string,
  requesterUserId: string,
  targetGuildId: string,
  targetGuildName: string,
  targetChannelId: string,
): Promise<string> {
  // Using global cache;
  const requestId = `${requesterGuildId}_${targetGuildId}_${Date.now()}`;
  const data = JSON.stringify({
    requesterGuildId,
    requesterGuildName,
    requesterChannelId,
    requesterUserId,
    targetGuildId,
    targetGuildName,
    targetChannelId,
  });
  cache.set(`userphone:contact_request:${requestId}`, data, 300);
  return requestId;
}

export interface ContactRequest {
  requesterGuildId: string;
  requesterGuildName: string;
  requesterChannelId: string;
  requesterUserId: string;
  targetGuildId: string;
  targetGuildName: string;
  targetChannelId: string;
}

/**
 * Get a pending contact request.
 */
export async function getContactRequest(requestId: string): Promise<ContactRequest | null> {
  // Using global cache;
  const data = cache.get<string>(`userphone:contact_request:${requestId}`);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Delete a contact request (after accept/deny).
 */
export async function deleteContactRequest(requestId: string): Promise<void> {
  // Using global cache;
  cache.del(`userphone:contact_request:${requestId}`);
}

/**
 * Store a pending direct call request in Redis (expires in 2 min).
 */
export async function createDirectCallRequest(
  requesterGuildId: string,
  requesterGuildName: string,
  requesterChannelId: string,
  targetGuildId: string,
  targetChannelId: string,
): Promise<string> {
  // Using global cache;
  const requestId = `dc_${requesterGuildId}_${targetGuildId}_${Date.now()}`;
  const data = JSON.stringify({
    requesterGuildId,
    requesterGuildName,
    requesterChannelId,
    targetGuildId,
    targetChannelId,
  });
  cache.set(`userphone:directcall:${requestId}`, data, 120);
  return requestId;
}

export interface DirectCallRequest {
  requesterGuildId: string;
  requesterGuildName: string;
  requesterChannelId: string;
  targetGuildId: string;
  targetChannelId: string;
}

/**
 * Get a pending direct call request.
 */
export async function getDirectCallRequest(requestId: string): Promise<DirectCallRequest | null> {
  // Using global cache;
  const data = cache.get<string>(`userphone:directcall:${requestId}`);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Delete a direct call request.
 */
export async function deleteDirectCallRequest(requestId: string): Promise<void> {
  // Using global cache;
  cache.del(`userphone:directcall:${requestId}`);
}
