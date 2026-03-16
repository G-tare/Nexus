import { Guild } from 'discord.js';
import { getDb, getPool } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { sql } from 'drizzle-orm';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { eventBus } from '../../Shared/src/events/eventBus';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { moduleContainer, addText } from '../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('VoicePhone');

// ============================================
// Config
// ============================================

export interface VoicePhoneConfig {
  /** Voice channels where voicephone can be used (empty = any) */
  allowedChannels: string[];
  /** Blacklisted server IDs */
  blacklistedServers: string[];
  /** Max call duration in seconds (0 = unlimited, default 600 = 10 min) */
  maxDuration: number;
  /** Cooldown between calls in seconds */
  callCooldown: number;
  /** Max speakers relayed per side */
  maxSpeakersPerSide: number;
  /** Opus bitrate for relay (32000-128000) */
  bitrate: number;
  /** Show server name to the other side */
  showServerName: boolean;
  /** Channel where reports are sent */
  reportChannelId: string | null;

  // ---- Safety & Trust ----
  /** Minimum member count for the server to use voice phone (default 50) */
  minServerSize: number;
  /** Require the server to be a Discord Community server (default true) */
  requireCommunity: boolean;
  /** Max strikes before auto-disconnect + temp ban (default 3) */
  maxStrikes: number;
  /** Temp ban duration in seconds after being auto-disconnected (default 3600 = 1h) */
  strikeBanDuration: number;
}

export async function getVoicePhoneConfig(guildId: string): Promise<VoicePhoneConfig> {
  const cfgResult = await moduleConfig.getModuleConfig(guildId, 'voicephone');
  const config = (cfgResult?.config ?? {}) as Record<string, any>;
  return {
    allowedChannels: config?.allowedChannels ?? [],
    blacklistedServers: config?.blacklistedServers ?? [],
    maxDuration: config?.maxDuration ?? 600,
    callCooldown: config?.callCooldown ?? 60,
    maxSpeakersPerSide: config?.maxSpeakersPerSide ?? 5,
    bitrate: config?.bitrate ?? 64000,
    showServerName: config?.showServerName ?? true,
    reportChannelId: config?.reportChannelId ?? null,
    minServerSize: config?.minServerSize ?? 50,
    requireCommunity: config?.requireCommunity ?? true,
    maxStrikes: config?.maxStrikes ?? 3,
    strikeBanDuration: config?.strikeBanDuration ?? 3600,
  };
}

// ============================================
// Active Voice Call State
// ============================================

export interface VoiceCall {
  callId: string;
  side1: { guildId: string; voiceChannelId: string; guildName: string };
  side2: { guildId: string; voiceChannelId: string; guildName: string };
  startedAt: number;
  maxDuration: number;
}

/**
 * Get the active voice call for a voice channel.
 */
export async function getActiveVoiceCall(voiceChannelId: string): Promise<VoiceCall | null> {
  // Using global cache;
  const callId = cache.get(`voicephone:channel:${voiceChannelId}`);
  if (!callId) return null;

  const data = cache.get<VoiceCall>(`voicephone:call:${callId}`);
  if (!data) return null;

  return data;
}

/**
 * Get the other side of a voice call.
 */
export function getOtherSide(
  call: VoiceCall,
  myVoiceChannelId: string,
): { guildId: string; voiceChannelId: string; guildName: string } | null {
  if (call.side1.voiceChannelId === myVoiceChannelId) return call.side2;
  if (call.side2.voiceChannelId === myVoiceChannelId) return call.side1;
  return null;
}

// ============================================
// Call Queue
// ============================================

interface VoiceQueueEntry {
  guildId: string;
  voiceChannelId: string;
  guildName: string;
  queuedAt: number;
}

/**
 * Add a voice channel to the call queue.
 */
export async function joinVoiceQueue(
  guildId: string,
  voiceChannelId: string,
  guildName: string,
): Promise<void> {
  // Using global cache;
  const entry: VoiceQueueEntry = { guildId, voiceChannelId, guildName, queuedAt: Date.now() };
  cache.set(`voicephone:queue:${voiceChannelId}`, JSON.stringify(entry), 120);
  cache.sadd('voicephone:queue', voiceChannelId);
}

/**
 * Remove a voice channel from the queue.
 */
export async function leaveVoiceQueue(voiceChannelId: string): Promise<void> {
  // Using global cache;
  cache.del(`voicephone:queue:${voiceChannelId}`);
  cache.srem('voicephone:queue', voiceChannelId);
}

/**
 * Find a matching voice channel in the queue (different guild, not blacklisted, eligible).
 */
export async function findVoiceMatch(
  guildId: string,
  voiceChannelId: string,
): Promise<VoiceQueueEntry | null> {
  // Using global cache;
  const config = await getVoicePhoneConfig(guildId);
  const members = cache.smembers('voicephone:queue');

  for (const queuedVcId of members) {
    if (queuedVcId === voiceChannelId) continue;

    const data = cache.get<VoiceQueueEntry>(`voicephone:queue:${queuedVcId}`);
    if (!data) {
      cache.srem('voicephone:queue', queuedVcId);
      continue;
    }

    try {
      const entry = data;

      // Don't match with same guild
      if (entry.guildId === guildId) continue;

      // Check if either side has blacklisted the other
      if (config.blacklistedServers.includes(entry.guildId)) continue;

      const otherConfig = await getVoicePhoneConfig(entry.guildId);
      if (otherConfig.blacklistedServers.includes(guildId)) continue;

      // Check server bans
      const myBanned = await isServerBanned(guildId);
      if (myBanned) continue;
      const theirBanned = await isServerBanned(entry.guildId);
      if (theirBanned) continue;

      return entry;
    } catch {
      cache.srem('voicephone:queue', queuedVcId);
    }
  }

  return null;
}

// ============================================
// Call Lifecycle
// ============================================

/**
 * Start a voice call between two voice channels.
 */
export async function startVoiceCall(
  side1: { guildId: string; voiceChannelId: string; guildName: string },
  side2: { guildId: string; voiceChannelId: string; guildName: string },
): Promise<VoiceCall> {
  // Using global cache;
  const callId = `vcall_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const config1 = await getVoicePhoneConfig(side1.guildId);
  const config2 = await getVoicePhoneConfig(side2.guildId);
  const maxDuration = Math.min(
    config1.maxDuration || 600,
    config2.maxDuration || 600,
  );

  const call: VoiceCall = {
    callId,
    side1,
    side2,
    startedAt: Date.now(),
    maxDuration,
  };

  // Store call data with TTL
  const ttl = maxDuration + 60;
  cache.set(`voicephone:call:${callId}`, JSON.stringify(call), ttl);
  cache.set(`voicephone:channel:${side1.voiceChannelId}`, callId, ttl);
  cache.set(`voicephone:channel:${side2.voiceChannelId}`, callId, ttl);

  // Remove both from queue
  await leaveVoiceQueue(side1.voiceChannelId);
  await leaveVoiceQueue(side2.voiceChannelId);

  logger.info('Voice call started', { callId, side1: side1.guildId, side2: side2.guildId });
  eventBus.emit('voicephoneCallStarted', {
    guildId1: side1.guildId,
    guildId2: side2.guildId,
    voiceChannelId1: side1.voiceChannelId,
    voiceChannelId2: side2.voiceChannelId,
    callId,
  });

  return call;
}

/**
 * End an active voice call and save to history.
 */
export async function endVoiceCall(callId: string): Promise<VoiceCall | null> {
  // Using global cache;
  const call = cache.get<VoiceCall>(`voicephone:call:${callId}`);
  if (!call) return null;

  // Clean up Redis
  cache.del(`voicephone:call:${callId}`);
  cache.del(`voicephone:channel:${call.side1.voiceChannelId}`);
  cache.del(`voicephone:channel:${call.side2.voiceChannelId}`);

  // Save to history
  const duration = Math.floor((Date.now() - call.startedAt) / 1000);
  const db = getDb();
  await db.execute(sql`
    INSERT INTO voicephone_history (call_id, guild1_id, voice_channel1_id, guild2_id, voice_channel2_id, started_at, duration)
    VALUES (${callId}, ${call.side1.guildId}, ${call.side1.voiceChannelId}, ${call.side2.guildId}, ${call.side2.voiceChannelId}, ${call.startedAt}, ${duration})
  `);

  // Update stats
  const calls1 = cache.hget(`voicephone:stats:${call.side1.guildId}`, 'calls') || '0';
  cache.hset(`voicephone:stats:${call.side1.guildId}`, 'calls', String(parseInt(calls1, 10) + 1));
  const duration1 = cache.hget(`voicephone:stats:${call.side1.guildId}`, 'totalDuration') || '0';
  cache.hset(`voicephone:stats:${call.side1.guildId}`, 'totalDuration', String(parseInt(duration1, 10) + duration));
  const calls2 = cache.hget(`voicephone:stats:${call.side2.guildId}`, 'calls') || '0';
  cache.hset(`voicephone:stats:${call.side2.guildId}`, 'calls', String(parseInt(calls2, 10) + 1));
  const duration2 = cache.hget(`voicephone:stats:${call.side2.guildId}`, 'totalDuration') || '0';
  cache.hset(`voicephone:stats:${call.side2.guildId}`, 'totalDuration', String(parseInt(duration2, 10) + duration));

  logger.info('Voice call ended', { callId, duration });
  eventBus.emit('voicephoneCallEnded', {
    guildId1: call.side1.guildId,
    guildId2: call.side2.guildId,
    callId,
    duration,
    reason: 'ended',
  });

  return call;
}

// ============================================
// Cooldowns
// ============================================

export async function isOnCooldown(guildId: string, voiceChannelId: string): Promise<boolean> {
  // Using global cache;
  return cache.has(`voicephone:cooldown:${guildId}:${voiceChannelId}`);
}

export async function setCooldown(guildId: string, voiceChannelId: string): Promise<void> {
  // Using global cache;
  const config = await getVoicePhoneConfig(guildId);
  cache.set(`voicephone:cooldown:${guildId}:${voiceChannelId}`, '1', config.callCooldown);
}

// ============================================
// Server Bans (shared with Userphone banning system)
// ============================================

export async function isServerBanned(guildId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT id FROM userphone_server_bans WHERE guild_id = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1',
    [guildId],
  );
  return (result.rows?.length ?? 0) > 0;
}

// ============================================
// Server Eligibility (Safety)
// ============================================

/**
 * Check if a guild meets the safety requirements for voice phone.
 * Returns null if eligible, or an error message if not.
 */
export async function checkServerEligibility(guild: Guild): Promise<string | null> {
  const config = await getVoicePhoneConfig(guild.id);

  // Minimum server size
  if (config.minServerSize > 0 && guild.memberCount < config.minServerSize) {
    return `❌ This server needs at least **${config.minServerSize} members** to use Voice Phone. Current: ${guild.memberCount}.`;
  }

  // Community server requirement
  if (config.requireCommunity && !guild.features.includes('COMMUNITY')) {
    return '❌ Voice Phone requires this server to be a **Community server**. Server admins can enable this in Server Settings → Community.';
  }

  return null;
}

// ============================================
// Strike System (Safety)
// ============================================

/**
 * Add a strike to a user during a voice call.
 * Returns the new strike count.
 */
export async function addStrike(callId: string, userId: string, guildId: string, reason: string): Promise<number> {
  // Using global cache;
  const key = `voicephone:strikes:${callId}:${userId}`;

  const count = cache.incr(key);
  // Expire strikes with the call (max 1 hour)
  cache.expire(key, 3600);

  // Log the strike
  logger.warn('Voice phone strike', { callId, userId, guildId, reason, strikeCount: count });

  // Also track global user strikes (rolling 24h window)
  const globalKey = `voicephone:globalstrikes:${userId}`;
  cache.incr(globalKey);
  cache.expire(globalKey, 86400);

  return count;
}

/**
 * Get the current strike count for a user in a call.
 */
export async function getStrikeCount(callId: string, userId: string): Promise<number> {
  // Using global cache;
  const val = cache.get<string>(`voicephone:strikes:${callId}:${userId}`);
  return val ? parseInt(val, 10) : 0;
}

/**
 * Get a user's global strike count (rolling 24h).
 */
export async function getGlobalStrikeCount(userId: string): Promise<number> {
  // Using global cache;
  const val = cache.get<string>(`voicephone:globalstrikes:${userId}`);
  return val ? parseInt(val, 10) : 0;
}

/**
 * Temporarily ban a user from voice phone.
 * Tracks the ban count — 3 temp bans = permanent ban.
 */
export async function tempBanUser(userId: string, durationSeconds: number, reason: string): Promise<{ permanent: boolean }> {
  // Using global cache;

  // Increment temp ban counter
  const banCountKey = `voicephone:bancount:${userId}`;
  const banCount = cache.incr(banCountKey);
  // Keep ban count forever (it's a lifetime counter)

  const PERMANENT_BAN_THRESHOLD = 3;

  if (banCount >= PERMANENT_BAN_THRESHOLD) {
    // 3rd temp ban → permanent ban
    await permanentBanUser(userId, `Automatic: reached ${PERMANENT_BAN_THRESHOLD} temporary bans. Latest: ${reason}`);
    logger.warn('User PERMANENTLY banned from voice phone', { userId, banCount, reason });
    return { permanent: true };
  }

  cache.set(`voicephone:userban:${userId}`, JSON.stringify({
    reason,
    bannedAt: Date.now(),
    expiresAt: Date.now() + (durationSeconds * 1000),
    banNumber: banCount,
  }), durationSeconds);
  logger.info('User temp-banned from voice phone', { userId, durationSeconds, reason, banNumber: banCount });
  return { permanent: false };
}

/**
 * Get the number of temp bans a user has received (lifetime).
 */
export async function getTempBanCount(userId: string): Promise<number> {
  // Using global cache;
  const val = cache.get<string>(`voicephone:bancount:${userId}`);
  return val ? parseInt(val, 10) : 0;
}

/**
 * Check if a user is temp-banned from voice phone.
 */
export async function isUserBanned(userId: string): Promise<{ banned: boolean; permanent?: boolean; reason?: string; expiresAt?: number; banNumber?: number }> {
  // Using global cache;

  // Check permanent ban first
  const permBan = cache.get<any>(`voicephone:permban:${userId}`);
  if (permBan) {
    return { banned: true, permanent: true, reason: permBan.reason };
  }

  // Check temp ban
  const ban = cache.get<any>(`voicephone:userban:${userId}`);
  if (!ban) return { banned: false };

  return { banned: true, permanent: false, reason: ban.reason, expiresAt: ban.expiresAt, banNumber: ban.banNumber };
}

// ============================================
// Permanent Bans
// ============================================

/**
 * Permanently ban a user from voice phone.
 */
export async function permanentBanUser(userId: string, reason: string): Promise<void> {
  // Using global cache;
  cache.set(`voicephone:permban:${userId}`, JSON.stringify({
    reason,
    bannedAt: Date.now(),
  }), 0);

  // Also save to DB for persistence across Redis flushes
  const db = getDb();
  await db.execute(sql`
    INSERT INTO voicephone_permanent_bans (user_id, reason, banned_at)
    VALUES (${userId}, ${reason}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET reason = ${reason}, banned_at = NOW()
  `);

  logger.warn('User PERMANENTLY banned from voice phone', { userId, reason });
}

/**
 * Check if a user is permanently banned (DB check, for when Redis is flushed).
 */
export async function syncPermBanFromDb(userId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT reason FROM voicephone_permanent_bans WHERE user_id = $1 LIMIT 1',
    [userId],
  );
  if ((result.rows?.length ?? 0) > 0) {
    // Using global cache;
    cache.set(`voicephone:permban:${userId}`, JSON.stringify({
      reason: result.rows[0].reason,
      bannedAt: Date.now(),
    }), 0);
    return true;
  }
  return false;
}

// ============================================
// Server Temp Bans (for circumvention)
// ============================================

/**
 * Temporarily ban an entire server from voice phone.
 * Used when server staff circumvents user bans (e.g. unmuting banned users).
 */
export async function tempBanServer(guildId: string, durationSeconds: number, reason: string): Promise<void> {
  // Using global cache;
  cache.set(`voicephone:serverban:${guildId}`, JSON.stringify({
    reason,
    bannedAt: Date.now(),
    expiresAt: Date.now() + (durationSeconds * 1000),
  }), durationSeconds);
  logger.warn('Server temp-banned from voice phone', { guildId, durationSeconds, reason });
}

/**
 * Check if a server is temp-banned from voice phone (separate from the global userphone_server_bans table).
 */
export async function isServerTempBanned(guildId: string): Promise<{ banned: boolean; reason?: string; expiresAt?: number }> {
  // Using global cache;
  const ban = cache.get<any>(`voicephone:serverban:${guildId}`);
  if (!ban) return { banned: false };

  return { banned: true, reason: ban.reason, expiresAt: ban.expiresAt };
}

// ============================================
// Appeal System
// ============================================

export interface VoicePhoneAppeal {
  appealId: string;
  userId: string;
  guildId: string;
  banType: 'temp' | 'permanent';
  reason: string;
  userStatement: string;
  audioClipIds: string[];
  status: 'pending' | 'approved' | 'denied';
  createdAt: number;
  resolvedAt?: number;
  resolution?: string;
}

/**
 * Submit an appeal against a voice phone ban.
 */
export async function submitAppeal(
  userId: string,
  guildId: string,
  banType: 'temp' | 'permanent',
  userStatement: string,
): Promise<VoicePhoneAppeal> {
  // Using global cache;
  const appealId = `vappeal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Collect any flagged audio clips for this user (for review)
  const clipKeys = cache.smembers(`voicephone:audioclips:${userId}`);

  const appeal: VoicePhoneAppeal = {
    appealId,
    userId,
    guildId,
    banType,
    reason: 'See flagged audio clips',
    userStatement,
    audioClipIds: clipKeys,
    status: 'pending',
    createdAt: Date.now(),
  };

  // Store the appeal (30 days)
  cache.set(`voicephone:appeal:${appealId}`, JSON.stringify(appeal), 30 * 86400);

  // Track user's appeal
  cache.set(`voicephone:activeappeal:${userId}`, appealId, 30 * 86400);

  // Add to the global pending appeals queue (stored as a set in cache)
  cache.sadd('voicephone:appeals:pending', appealId);

  logger.info('Voice phone appeal submitted', { appealId, userId, banType });

  return appeal;
}

/**
 * Check if a user has a pending appeal.
 */
export async function hasActiveAppeal(userId: string): Promise<string | null> {
  // Using global cache;
  return cache.get(`voicephone:activeappeal:${userId}`);
}

/**
 * Get an appeal by ID.
 */
export async function getAppeal(appealId: string): Promise<VoicePhoneAppeal | null> {
  // Using global cache;
  return cache.get<VoicePhoneAppeal>(`voicephone:appeal:${appealId}`);
}

/**
 * Resolve an appeal (approve or deny).
 */
export async function resolveAppeal(
  appealId: string,
  status: 'approved' | 'denied',
  resolution: string,
): Promise<VoicePhoneAppeal | null> {
  // Using global cache;
  const appeal = await getAppeal(appealId);
  if (!appeal) return null;

  appeal.status = status;
  appeal.resolvedAt = Date.now();
  appeal.resolution = resolution;

  // Update the appeal (keep it around for 30 days)
  cache.set(`voicephone:appeal:${appealId}`, JSON.stringify(appeal), 30 * 86400);

  // Remove from pending queue
  cache.srem('voicephone:appeals:pending', appealId);

  // If approved, unban the user
  if (status === 'approved') {
    await unbanUser(appeal.userId);
  }

  // Clear user's active appeal reference
  cache.del(`voicephone:activeappeal:${appeal.userId}`);

  logger.info('Voice phone appeal resolved', { appealId, status, resolution });
  return appeal;
}

/**
 * Unban a user from voice phone (removes both temp and permanent bans).
 */
export async function unbanUser(userId: string): Promise<void> {
  // Using global cache;

  // Remove permanent ban from Redis
  cache.del(`voicephone:permban:${userId}`);

  // Remove temp ban from Redis
  cache.del(`voicephone:userban:${userId}`);

  // Reset the ban counter so they get a fresh start
  cache.del(`voicephone:bancount:${userId}`);

  // Remove from DB permanent bans table
  const pool = getPool();
  await pool.query('DELETE FROM voicephone_permanent_bans WHERE user_id = $1', [userId]);

  logger.info('User unbanned from voice phone', { userId });
}

/**
 * Get all pending appeal IDs.
 */
export async function getPendingAppeals(): Promise<string[]> {
  // Using global cache;
  return cache.smembers('voicephone:appeals:pending');
}

/**
 * Get voice phone global stats (total calls, total duration across all guilds).
 */
export async function getGlobalStats(): Promise<{ totalCalls: number; totalDuration: number; activeCalls: number; pendingAppeals: number; permanentBans: number }> {
  // Using global cache;
  const pool = getPool();

  // Count active calls - use smembers since we store them in a set-like manner
  // For now, we'll count from the DB which is more reliable
  const activeCalls = 0;

  // Count pending appeals
  const pendingList = cache.smembers('voicephone:appeals:pending');

  // Count permanent bans from DB
  const permBanResult = await pool.query('SELECT COUNT(*) as count FROM voicephone_permanent_bans');
  const permanentBans = parseInt(permBanResult.rows[0]?.count ?? '0', 10);

  // Get totals from DB
  const historyResult = await pool.query('SELECT COUNT(*) as calls, COALESCE(SUM(duration), 0) as total_duration FROM voicephone_history');
  const totalCalls = parseInt(historyResult.rows[0]?.calls ?? '0', 10);
  const totalDuration = parseInt(historyResult.rows[0]?.total_duration ?? '0', 10);

  return {
    totalCalls,
    totalDuration,
    activeCalls,
    pendingAppeals: pendingList.length,
    permanentBans,
  };
}

// ============================================
// Flagged Audio Clips
// ============================================

/**
 * Store a flagged audio clip (PCM data around the flagged moment).
 * The clip is stored in Redis with a 7-day TTL.
 * If no appeal is filed, it auto-deletes.
 */
export async function storeFlaggedAudioClip(
  userId: string,
  callId: string,
  reason: string,
  audioBuffer: Buffer,
): Promise<string> {
  // Using global cache;
  const clipId = `vclip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Store the clip metadata
  cache.set(`voicephone:clip:${clipId}:meta`, JSON.stringify({
    clipId,
    userId,
    callId,
    reason,
    createdAt: Date.now(),
    durationMs: Math.floor((audioBuffer.length / (48000 * 2 * 2)) * 1000), // PCM: 48kHz stereo 16-bit
  }), 7 * 86400);

  // Store the raw audio data (base64-encoded to fit in cache)
  cache.set(`voicephone:clip:${clipId}:audio`, audioBuffer.toString('base64'), 7 * 86400);

  // Add to the user's clip list using a set
  cache.sadd(`voicephone:audioclips:${userId}`, clipId);
  cache.expire(`voicephone:audioclips:${userId}`, 7 * 86400);

  logger.info('Flagged audio clip stored', { clipId, userId, callId, reason, sizeBytes: audioBuffer.length });

  return clipId;
}

/**
 * Extend the TTL of flagged audio clips when an appeal is filed.
 * Extends to 30 days to match the appeal TTL.
 */
export async function extendClipRetention(clipIds: string[]): Promise<void> {
  // Using global cache;
  for (const clipId of clipIds) {
    cache.expire(`voicephone:clip:${clipId}:meta`, 30 * 86400);
    cache.expire(`voicephone:clip:${clipId}:audio`, 30 * 86400);
  }
}

/**
 * Build an appeal confirmation container.
 */
export function buildAppealContainer(appealId: string, clipCount: number) {
  const container = moduleContainer('voicephone');
  addText(container,
    `### 📝 Appeal Submitted\n\n` +
    `🆔 Appeal ID: \`${appealId}\`\n` +
    `🎙️ Flagged audio clips attached: **${clipCount}**\n\n` +
    'Our team will listen to the flagged audio segments and review your statement. ' +
    'You will be notified when a decision is made.\n\n' +
    '*Audio clips are only retained for the duration of the review and are deleted afterward.*'
  );
  return container;
}

/**
 * Build a "permanent ban" notification container.
 */
export function buildPermBanContainer(reason: string) {
  const container = moduleContainer('voicephone');
  addText(container,
    `### ⛔ Permanently Banned from Voice Phone\n\n` +
    `You have been **permanently banned** from Voice Phone.\n\n` +
    `📋 Reason: ${reason}\n\n` +
    'If you believe this was a mistake, you can submit an appeal using `/voicecall appeal`.'
  );
  return container;
}

/**
 * Build a "server temp ban" container for when staff circumvents safety measures.
 */
export function buildServerBanContainer(durationSeconds: number, reason: string) {
  const container = moduleContainer('voicephone');
  addText(container,
    `### 🚫 Server Temporarily Banned from Voice Phone\n\n` +
    `This server has been temporarily banned from using Voice Phone.\n\n` +
    `📋 Reason: ${reason}\n` +
    `⏱️ Duration: **${formatDuration(durationSeconds)}**\n\n` +
    'Server staff attempted to circumvent a safety enforcement action. ' +
    'Repeated violations may result in a permanent server ban.'
  );
  return container;
}

// ============================================
// Report System
// ============================================

export interface VoicePhoneReport {
  reportId: string;
  callId: string;
  reporterUserId: string;
  reporterGuildId: string;
  targetGuildId: string;
  reason: string;
  createdAt: number;
}

/**
 * Submit a report for a voice call.
 */
export async function submitVoiceReport(
  callId: string,
  reporterUserId: string,
  reporterGuildId: string,
  targetGuildId: string,
  reason: string,
): Promise<VoicePhoneReport> {
  // Using global cache;
  const reportId = `vrpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const report: VoicePhoneReport = {
    reportId,
    callId,
    reporterUserId,
    reporterGuildId,
    targetGuildId,
    reason,
    createdAt: Date.now(),
  };

  // Store the report (30 days TTL)
  cache.set(`voicephone:report:${reportId}`, JSON.stringify(report), 30 * 86400);

  // Add to the report list for both guilds using sets
  cache.sadd(`voicephone:reports:${reporterGuildId}`, reportId);
  cache.sadd(`voicephone:reports:${targetGuildId}`, reportId);

  // Track global report count for the target guild (rolling 7 days)
  const countKey = `voicephone:reportcount:${targetGuildId}`;
  cache.incr(countKey);
  cache.expire(countKey, 7 * 86400);

  logger.info('Voice phone report submitted', { reportId, callId, reporterGuildId, targetGuildId });

  return report;
}

/**
 * Get the report count for a guild (rolling 7 days).
 */
export async function getGuildReportCount(guildId: string): Promise<number> {
  // Using global cache;
  const val = cache.get<string>(`voicephone:reportcount:${guildId}`);
  return val ? parseInt(val, 10) : 0;
}

/**
 * Build a "Strike Warning" container.
 */
export function buildStrikeContainer(strikeCount: number, maxStrikes: number, reason: string) {
  const container = moduleContainer('voicephone');
  addText(container,
    `### ⚠️ Voice Call Warning\n\n` +
    `📋 Reason: ${reason}\n` +
    `⚠️ Strikes: **${strikeCount}/${maxStrikes}**\n\n` +
    (strikeCount >= maxStrikes
      ? '🔇 **Maximum strikes reached — call will be terminated.**'
      : `${maxStrikes - strikeCount} more strike(s) before the call is automatically ended.`)
  );
  return container;
}

/**
 * Build a "User Banned" container for when a user is temp-banned.
 */
export function buildUserBannedContainer(durationSeconds: number, reason: string) {
  const container = moduleContainer('voicephone');
  addText(container,
    `### 🚫 Temporarily Banned from Voice Phone\n\n` +
    `You have been temporarily banned from using Voice Phone.\n\n` +
    `📋 Reason: ${reason}\n` +
    `⏱️ Duration: **${formatDuration(durationSeconds)}**\n\n` +
    'This ban was applied automatically due to repeated violations.'
  );
  return container;
}

/**
 * Build a report confirmation container.
 */
export function buildReportContainer(reportId: string) {
  const container = moduleContainer('voicephone');
  addText(container,
    `### 📋 Voice Call Report Submitted\n\n` +
    `Your report has been recorded.\n\n` +
    `🆔 Report ID: \`${reportId}\`\n\n` +
    'Our team will review this. Repeated reports against a server may result in them being banned from Voice Phone.'
  );
  return container;
}

// ============================================
// Utilities
// ============================================

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Build a "Connected" container for when a voice call connects.
 */
export function buildConnectedContainer(otherGuildName: string, showName: boolean) {
  const container = moduleContainer('voicephone');
  addText(container,
    `### 📞 Voice Call Connected!\n\n` +
    `You are now in a voice call with ${showName ? `**${otherGuildName}**` : 'another server'}.\n\n` +
    '🎙️ Speak in the voice channel — your audio will be relayed to the other server.\n' +
    '🔇 Use `/voicecall hangup` to end the call.'
  );
  return container;
}

/**
 * Build a "Searching" container for when entering the queue.
 */
export function buildSearchingContainer() {
  const container = moduleContainer('voicephone');
  addText(container,
    `### 📞 Searching for a Voice Call...\n\n` +
    '🔍 Looking for another server to connect with.\n' +
    'Make sure you\'re in the voice channel!\n\n' +
    '⏳ The search will expire after **2 minutes**.\n' +
    'Use `/voicecall hangup` to cancel.'
  );
  return container;
}

/**
 * Build a "Call Ended" container.
 */
export function buildCallEndedContainer(duration: number, reason: string) {
  const container = moduleContainer('voicephone');
  addText(container,
    `### 📞 Voice Call Ended\n\n` +
    `The voice call has ended.\n\n` +
    `⏱️ Duration: **${formatDuration(duration)}**\n` +
    `📋 Reason: ${reason}`
  );
  return container;
}
