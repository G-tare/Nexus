import {
  Guild,
  TextChannel,
  EmbedBuilder,
  Message,
} from 'discord.js';
import { getDb, getPool } from '../../Shared/src/database/connection';
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

      // Check if either server is banned from userphone (bot owner ban)
      const myBanned = await isServerBanned(guildId);
      if (myBanned) continue;
      const theirBanned = await isServerBanned(entry.guildId);
      if (theirBanned) continue;

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

/**
 * Extend the call duration by resetting startedAt and refreshing TTLs.
 */
export async function extendCall(callId: string): Promise<boolean> {
  const redis = getRedis();
  const data = await redis.get(`userphone:call:${callId}`);
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
  await redis.setex(`userphone:call:${callId}`, ttl, JSON.stringify(call));
  await redis.expire(`userphone:channel:${call.side1.channelId}`, ttl);
  await redis.expire(`userphone:channel:${call.side2.channelId}`, ttl);

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
    // Plain text format — no embed
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
    // Embed format (default)
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setAuthor({
        name: `📞 ${senderName}`,
        iconURL: message.author.displayAvatarURL(),
      })
      .setTimestamp();

    if (hasText) {
      embed.setDescription(message.content);
    }

    if (senderConfig.allowAttachments && hasAttachments) {
      const firstAttachment = message.attachments.first();
      if (firstAttachment && firstAttachment.size < 8_000_000 && firstAttachment.contentType?.startsWith('image/')) {
        embed.setImage(firstAttachment.url);
      }
    }

    await (targetChannel as any).send({ embeds: [embed], files }).catch((err: any) => {
      logger.error('Failed to relay message', { error: err.message });
    });
  }

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
  const redis = getRedis();
  const entry: TranscriptMessage = {
    author: message.author.displayName,
    authorId: message.author.id,
    guildName: message.guild?.name || 'Unknown',
    guildId: message.guild?.id || '0',
    content: message.content || '',
    timestamp: Date.now(),
    hasAttachment: message.attachments.size > 0,
  };
  await redis.rpush(`userphone:transcript:${callId}`, JSON.stringify(entry));
  // Keep transcript for 1 hour after call ends
  await redis.expire(`userphone:transcript:${callId}`, 3600);
}

/**
 * Get the full transcript for a call.
 */
export async function getTranscript(callId: string): Promise<TranscriptMessage[]> {
  const redis = getRedis();
  const raw = await redis.lrange(`userphone:transcript:${callId}`, 0, -1);
  const messages: TranscriptMessage[] = [];
  for (const item of raw) {
    try {
      messages.push(JSON.parse(item) as TranscriptMessage);
    } catch {
      // skip corrupt entries
    }
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
  const redis = getRedis();
  const data = JSON.stringify({ callId, otherGuildId, otherGuildName });
  await redis.setex(`userphone:lastcall:${channelId}`, 600, data);
}

/**
 * Get last call info for a channel (for reporting after call ends).
 */
export async function getLastCallInfo(
  channelId: string,
): Promise<{ callId: string; otherGuildId: string; otherGuildName: string } | null> {
  const redis = getRedis();
  const data = await redis.get(`userphone:lastcall:${channelId}`);
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
  const redis = getRedis();
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
  await redis.setex(`userphone:contact_request:${requestId}`, 300, data);
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
  const redis = getRedis();
  const data = await redis.get(`userphone:contact_request:${requestId}`);
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
  const redis = getRedis();
  await redis.del(`userphone:contact_request:${requestId}`);
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
  const redis = getRedis();
  const requestId = `dc_${requesterGuildId}_${targetGuildId}_${Date.now()}`;
  const data = JSON.stringify({
    requesterGuildId,
    requesterGuildName,
    requesterChannelId,
    targetGuildId,
    targetChannelId,
  });
  await redis.setex(`userphone:directcall:${requestId}`, 120, data);
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
  const redis = getRedis();
  const data = await redis.get(`userphone:directcall:${requestId}`);
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
  const redis = getRedis();
  await redis.del(`userphone:directcall:${requestId}`);
}
