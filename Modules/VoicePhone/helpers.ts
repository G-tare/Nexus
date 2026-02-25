import { EmbedBuilder, Guild } from 'discord.js';
import { getDb, getPool, getRedis } from '../../Shared/src/database/connection';
import { sql } from 'drizzle-orm';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { eventBus } from '../../Shared/src/events/eventBus';
import { createModuleLogger } from '../../Shared/src/utils/logger';

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
  const redis = getRedis();
  const callId = await redis.get(`voicephone:channel:${voiceChannelId}`);
  if (!callId) return null;

  const data = await redis.get(`voicephone:call:${callId}`);
  if (!data) return null;

  try {
    return JSON.parse(data) as VoiceCall;
  } catch {
    return null;
  }
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
  const redis = getRedis();
  const entry: VoiceQueueEntry = { guildId, voiceChannelId, guildName, queuedAt: Date.now() };
  await redis.setex(`voicephone:queue:${voiceChannelId}`, 120, JSON.stringify(entry));
  await redis.sadd('voicephone:queue', voiceChannelId);
}

/**
 * Remove a voice channel from the queue.
 */
export async function leaveVoiceQueue(voiceChannelId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`voicephone:queue:${voiceChannelId}`);
  await redis.srem('voicephone:queue', voiceChannelId);
}

/**
 * Find a matching voice channel in the queue (different guild, not blacklisted, eligible).
 */
export async function findVoiceMatch(
  guildId: string,
  voiceChannelId: string,
): Promise<VoiceQueueEntry | null> {
  const redis = getRedis();
  const config = await getVoicePhoneConfig(guildId);
  const members = await redis.smembers('voicephone:queue');

  for (const queuedVcId of members) {
    if (queuedVcId === voiceChannelId) continue;

    const data = await redis.get(`voicephone:queue:${queuedVcId}`);
    if (!data) {
      await redis.srem('voicephone:queue', queuedVcId);
      continue;
    }

    try {
      const entry = JSON.parse(data) as VoiceQueueEntry;

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
      await redis.srem('voicephone:queue', queuedVcId);
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
  const redis = getRedis();
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
  await redis.setex(`voicephone:call:${callId}`, ttl, JSON.stringify(call));
  await redis.setex(`voicephone:channel:${side1.voiceChannelId}`, ttl, callId);
  await redis.setex(`voicephone:channel:${side2.voiceChannelId}`, ttl, callId);

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
  const redis = getRedis();
  const data = await redis.get(`voicephone:call:${callId}`);
  if (!data) return null;

  let call: VoiceCall;
  try {
    call = JSON.parse(data);
  } catch {
    return null;
  }

  // Clean up Redis
  await redis.del(`voicephone:call:${callId}`);
  await redis.del(`voicephone:channel:${call.side1.voiceChannelId}`);
  await redis.del(`voicephone:channel:${call.side2.voiceChannelId}`);

  // Save to history
  const duration = Math.floor((Date.now() - call.startedAt) / 1000);
  const db = getDb();
  await db.execute(sql`
    INSERT INTO voicephone_history (call_id, guild1_id, voice_channel1_id, guild2_id, voice_channel2_id, started_at, duration)
    VALUES (${callId}, ${call.side1.guildId}, ${call.side1.voiceChannelId}, ${call.side2.guildId}, ${call.side2.voiceChannelId}, ${call.startedAt}, ${duration})
  `);

  // Update stats
  await redis.hincrby(`voicephone:stats:${call.side1.guildId}`, 'calls', 1);
  await redis.hincrby(`voicephone:stats:${call.side1.guildId}`, 'totalDuration', duration);
  await redis.hincrby(`voicephone:stats:${call.side2.guildId}`, 'calls', 1);
  await redis.hincrby(`voicephone:stats:${call.side2.guildId}`, 'totalDuration', duration);

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
  const redis = getRedis();
  return (await redis.exists(`voicephone:cooldown:${guildId}:${voiceChannelId}`)) === 1;
}

export async function setCooldown(guildId: string, voiceChannelId: string): Promise<void> {
  const redis = getRedis();
  const config = await getVoicePhoneConfig(guildId);
  await redis.setex(`voicephone:cooldown:${guildId}:${voiceChannelId}`, config.callCooldown, '1');
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
  const redis = getRedis();
  const key = `voicephone:strikes:${callId}:${userId}`;

  const count = await redis.incr(key);
  // Expire strikes with the call (max 1 hour)
  await redis.expire(key, 3600);

  // Log the strike
  logger.warn('Voice phone strike', { callId, userId, guildId, reason, strikeCount: count });

  // Also track global user strikes (rolling 24h window)
  const globalKey = `voicephone:globalstrikes:${userId}`;
  await redis.incr(globalKey);
  await redis.expire(globalKey, 86400);

  return count;
}

/**
 * Get the current strike count for a user in a call.
 */
export async function getStrikeCount(callId: string, userId: string): Promise<number> {
  const redis = getRedis();
  const val = await redis.get(`voicephone:strikes:${callId}:${userId}`);
  return val ? parseInt(val, 10) : 0;
}

/**
 * Get a user's global strike count (rolling 24h).
 */
export async function getGlobalStrikeCount(userId: string): Promise<number> {
  const redis = getRedis();
  const val = await redis.get(`voicephone:globalstrikes:${userId}`);
  return val ? parseInt(val, 10) : 0;
}

/**
 * Temporarily ban a user from voice phone.
 * Tracks the ban count — 3 temp bans = permanent ban.
 */
export async function tempBanUser(userId: string, durationSeconds: number, reason: string): Promise<{ permanent: boolean }> {
  const redis = getRedis();

  // Increment temp ban counter
  const banCountKey = `voicephone:bancount:${userId}`;
  const banCount = await redis.incr(banCountKey);
  // Keep ban count forever (it's a lifetime counter)

  const PERMANENT_BAN_THRESHOLD = 3;

  if (banCount >= PERMANENT_BAN_THRESHOLD) {
    // 3rd temp ban → permanent ban
    await permanentBanUser(userId, `Automatic: reached ${PERMANENT_BAN_THRESHOLD} temporary bans. Latest: ${reason}`);
    logger.warn('User PERMANENTLY banned from voice phone', { userId, banCount, reason });
    return { permanent: true };
  }

  await redis.setex(`voicephone:userban:${userId}`, durationSeconds, JSON.stringify({
    reason,
    bannedAt: Date.now(),
    expiresAt: Date.now() + (durationSeconds * 1000),
    banNumber: banCount,
  }));
  logger.info('User temp-banned from voice phone', { userId, durationSeconds, reason, banNumber: banCount });
  return { permanent: false };
}

/**
 * Get the number of temp bans a user has received (lifetime).
 */
export async function getTempBanCount(userId: string): Promise<number> {
  const redis = getRedis();
  const val = await redis.get(`voicephone:bancount:${userId}`);
  return val ? parseInt(val, 10) : 0;
}

/**
 * Check if a user is temp-banned from voice phone.
 */
export async function isUserBanned(userId: string): Promise<{ banned: boolean; permanent?: boolean; reason?: string; expiresAt?: number; banNumber?: number }> {
  const redis = getRedis();

  // Check permanent ban first
  const permBan = await redis.get(`voicephone:permban:${userId}`);
  if (permBan) {
    try {
      const ban = JSON.parse(permBan);
      return { banned: true, permanent: true, reason: ban.reason };
    } catch {
      return { banned: true, permanent: true, reason: 'Permanently banned' };
    }
  }

  // Check temp ban
  const data = await redis.get(`voicephone:userban:${userId}`);
  if (!data) return { banned: false };

  try {
    const ban = JSON.parse(data);
    return { banned: true, permanent: false, reason: ban.reason, expiresAt: ban.expiresAt, banNumber: ban.banNumber };
  } catch {
    return { banned: false };
  }
}

// ============================================
// Permanent Bans
// ============================================

/**
 * Permanently ban a user from voice phone.
 */
export async function permanentBanUser(userId: string, reason: string): Promise<void> {
  const redis = getRedis();
  await redis.set(`voicephone:permban:${userId}`, JSON.stringify({
    reason,
    bannedAt: Date.now(),
  }));

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
    const redis = getRedis();
    await redis.set(`voicephone:permban:${userId}`, JSON.stringify({
      reason: result.rows[0].reason,
      bannedAt: Date.now(),
    }));
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
  const redis = getRedis();
  await redis.setex(`voicephone:serverban:${guildId}`, durationSeconds, JSON.stringify({
    reason,
    bannedAt: Date.now(),
    expiresAt: Date.now() + (durationSeconds * 1000),
  }));
  logger.warn('Server temp-banned from voice phone', { guildId, durationSeconds, reason });
}

/**
 * Check if a server is temp-banned from voice phone (separate from the global userphone_server_bans table).
 */
export async function isServerTempBanned(guildId: string): Promise<{ banned: boolean; reason?: string; expiresAt?: number }> {
  const redis = getRedis();
  const data = await redis.get(`voicephone:serverban:${guildId}`);
  if (!data) return { banned: false };

  try {
    const ban = JSON.parse(data);
    return { banned: true, reason: ban.reason, expiresAt: ban.expiresAt };
  } catch {
    return { banned: false };
  }
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
  const redis = getRedis();
  const appealId = `vappeal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Collect any flagged audio clips for this user (for review)
  const clipKeys = await redis.lrange(`voicephone:audioclips:${userId}`, 0, -1);

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
  await redis.setex(`voicephone:appeal:${appealId}`, 30 * 86400, JSON.stringify(appeal));

  // Track user's appeal
  await redis.setex(`voicephone:activeappeal:${userId}`, 30 * 86400, appealId);

  // Add to the global pending appeals queue
  await redis.lpush('voicephone:appeals:pending', appealId);
  await redis.ltrim('voicephone:appeals:pending', 0, 499);

  logger.info('Voice phone appeal submitted', { appealId, userId, banType });

  return appeal;
}

/**
 * Check if a user has a pending appeal.
 */
export async function hasActiveAppeal(userId: string): Promise<string | null> {
  const redis = getRedis();
  return await redis.get(`voicephone:activeappeal:${userId}`);
}

/**
 * Get an appeal by ID.
 */
export async function getAppeal(appealId: string): Promise<VoicePhoneAppeal | null> {
  const redis = getRedis();
  const data = await redis.get(`voicephone:appeal:${appealId}`);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Resolve an appeal (approve or deny).
 */
export async function resolveAppeal(
  appealId: string,
  status: 'approved' | 'denied',
  resolution: string,
): Promise<VoicePhoneAppeal | null> {
  const redis = getRedis();
  const appeal = await getAppeal(appealId);
  if (!appeal) return null;

  appeal.status = status;
  appeal.resolvedAt = Date.now();
  appeal.resolution = resolution;

  // Update the appeal (keep it around for 30 days)
  await redis.setex(`voicephone:appeal:${appealId}`, 30 * 86400, JSON.stringify(appeal));

  // Remove from pending queue
  await redis.lrem('voicephone:appeals:pending', 0, appealId);

  // If approved, unban the user
  if (status === 'approved') {
    await unbanUser(appeal.userId);
  }

  // Clear user's active appeal reference
  await redis.del(`voicephone:activeappeal:${appeal.userId}`);

  logger.info('Voice phone appeal resolved', { appealId, status, resolution });
  return appeal;
}

/**
 * Unban a user from voice phone (removes both temp and permanent bans).
 */
export async function unbanUser(userId: string): Promise<void> {
  const redis = getRedis();

  // Remove permanent ban from Redis
  await redis.del(`voicephone:permban:${userId}`);

  // Remove temp ban from Redis
  await redis.del(`voicephone:userban:${userId}`);

  // Reset the ban counter so they get a fresh start
  await redis.del(`voicephone:bancount:${userId}`);

  // Remove from DB permanent bans table
  const pool = getPool();
  await pool.query('DELETE FROM voicephone_permanent_bans WHERE user_id = $1', [userId]);

  logger.info('User unbanned from voice phone', { userId });
}

/**
 * Get all pending appeal IDs.
 */
export async function getPendingAppeals(): Promise<string[]> {
  const redis = getRedis();
  return await redis.lrange('voicephone:appeals:pending', 0, -1);
}

/**
 * Get voice phone global stats (total calls, total duration across all guilds).
 */
export async function getGlobalStats(): Promise<{ totalCalls: number; totalDuration: number; activeCalls: number; pendingAppeals: number; permanentBans: number }> {
  const redis = getRedis();
  const pool = getPool();

  // Count active calls from Redis
  let activeCalls = 0;
  let cursor = '0';
  do {
    const [newCursor, keys] = await redis.scan(cursor, 'MATCH', 'voicephone:call:*', 'COUNT', 100);
    cursor = newCursor;
    activeCalls += keys.length;
  } while (cursor !== '0');

  // Count pending appeals
  const pendingList = await redis.lrange('voicephone:appeals:pending', 0, -1);

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
  const redis = getRedis();
  const clipId = `vclip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Store the clip metadata
  await redis.setex(`voicephone:clip:${clipId}:meta`, 7 * 86400, JSON.stringify({
    clipId,
    userId,
    callId,
    reason,
    createdAt: Date.now(),
    durationMs: Math.floor((audioBuffer.length / (48000 * 2 * 2)) * 1000), // PCM: 48kHz stereo 16-bit
  }));

  // Store the raw audio data (base64-encoded to fit in Redis)
  await redis.setex(`voicephone:clip:${clipId}:audio`, 7 * 86400, audioBuffer.toString('base64'));

  // Add to the user's clip list
  await redis.lpush(`voicephone:audioclips:${userId}`, clipId);
  await redis.ltrim(`voicephone:audioclips:${userId}`, 0, 19); // Keep max 20 clips
  await redis.expire(`voicephone:audioclips:${userId}`, 7 * 86400);

  logger.info('Flagged audio clip stored', { clipId, userId, callId, reason, sizeBytes: audioBuffer.length });

  return clipId;
}

/**
 * Extend the TTL of flagged audio clips when an appeal is filed.
 * Extends to 30 days to match the appeal TTL.
 */
export async function extendClipRetention(clipIds: string[]): Promise<void> {
  const redis = getRedis();
  for (const clipId of clipIds) {
    await redis.expire(`voicephone:clip:${clipId}:meta`, 30 * 86400);
    await redis.expire(`voicephone:clip:${clipId}:audio`, 30 * 86400);
  }
}

/**
 * Build an appeal confirmation embed.
 */
export function buildAppealEmbed(appealId: string, clipCount: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('📝 Appeal Submitted')
    .setDescription(
      `Your appeal has been submitted for review.\n\n` +
      `🆔 Appeal ID: \`${appealId}\`\n` +
      `🎙️ Flagged audio clips attached: **${clipCount}**\n\n` +
      'Our team will listen to the flagged audio segments and review your statement. ' +
      'You will be notified when a decision is made.\n\n' +
      '*Audio clips are only retained for the duration of the review and are deleted afterward.*',
    )
    .setTimestamp();
}

/**
 * Build a "permanent ban" notification embed.
 */
export function buildPermBanEmbed(reason: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x992D22)
    .setTitle('⛔ Permanently Banned from Voice Phone')
    .setDescription(
      `You have been **permanently banned** from Voice Phone.\n\n` +
      `📋 Reason: ${reason}\n\n` +
      'If you believe this was a mistake, you can submit an appeal using `/voicecall appeal`.',
    )
    .setTimestamp();
}

/**
 * Build a "server temp ban" embed for when staff circumvents safety measures.
 */
export function buildServerBanEmbed(durationSeconds: number, reason: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x992D22)
    .setTitle('🚫 Server Temporarily Banned from Voice Phone')
    .setDescription(
      `This server has been temporarily banned from using Voice Phone.\n\n` +
      `📋 Reason: ${reason}\n` +
      `⏱️ Duration: **${formatDuration(durationSeconds)}**\n\n` +
      'Server staff attempted to circumvent a safety enforcement action. ' +
      'Repeated violations may result in a permanent server ban.',
    )
    .setTimestamp();
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
  const redis = getRedis();
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
  await redis.setex(`voicephone:report:${reportId}`, 30 * 86400, JSON.stringify(report));

  // Add to the report list for both guilds
  await redis.lpush(`voicephone:reports:${reporterGuildId}`, reportId);
  await redis.ltrim(`voicephone:reports:${reporterGuildId}`, 0, 99);
  await redis.lpush(`voicephone:reports:${targetGuildId}`, reportId);
  await redis.ltrim(`voicephone:reports:${targetGuildId}`, 0, 99);

  // Track global report count for the target guild (rolling 7 days)
  const countKey = `voicephone:reportcount:${targetGuildId}`;
  await redis.incr(countKey);
  await redis.expire(countKey, 7 * 86400);

  logger.info('Voice phone report submitted', { reportId, callId, reporterGuildId, targetGuildId });

  return report;
}

/**
 * Get the report count for a guild (rolling 7 days).
 */
export async function getGuildReportCount(guildId: string): Promise<number> {
  const redis = getRedis();
  const val = await redis.get(`voicephone:reportcount:${guildId}`);
  return val ? parseInt(val, 10) : 0;
}

/**
 * Build a "Strike Warning" embed.
 */
export function buildStrikeEmbed(strikeCount: number, maxStrikes: number, reason: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle('⚠️ Voice Call Warning')
    .setDescription(
      `A user has received a warning.\n\n` +
      `📋 Reason: ${reason}\n` +
      `⚠️ Strikes: **${strikeCount}/${maxStrikes}**\n\n` +
      (strikeCount >= maxStrikes
        ? '🔇 **Maximum strikes reached — call will be terminated.**'
        : `${maxStrikes - strikeCount} more strike(s) before the call is automatically ended.`),
    )
    .setTimestamp();
}

/**
 * Build a "User Banned" embed for when a user is temp-banned.
 */
export function buildUserBannedEmbed(durationSeconds: number, reason: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('🚫 Temporarily Banned from Voice Phone')
    .setDescription(
      `You have been temporarily banned from using Voice Phone.\n\n` +
      `📋 Reason: ${reason}\n` +
      `⏱️ Duration: **${formatDuration(durationSeconds)}**\n\n` +
      'This ban was applied automatically due to repeated violations.',
    )
    .setTimestamp();
}

/**
 * Build a report confirmation embed.
 */
export function buildReportEmbed(reportId: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('📋 Voice Call Report Submitted')
    .setDescription(
      `Your report has been recorded.\n\n` +
      `🆔 Report ID: \`${reportId}\`\n\n` +
      'Our team will review this. Repeated reports against a server may result in them being banned from Voice Phone.',
    )
    .setTimestamp();
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
 * Build a "Connected" embed for when a voice call connects.
 */
export function buildConnectedEmbed(otherGuildName: string, showName: boolean): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('📞 Voice Call Connected!')
    .setDescription(
      `You are now in a voice call with ${showName ? `**${otherGuildName}**` : 'another server'}.\n\n` +
      '🎙️ Speak in the voice channel — your audio will be relayed to the other server.\n' +
      '🔇 Use `/voicecall hangup` to end the call.',
    )
    .setTimestamp();
}

/**
 * Build a "Searching" embed for when entering the queue.
 */
export function buildSearchingEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle('📞 Searching for a Voice Call...')
    .setDescription(
      '🔍 Looking for another server to connect with.\n' +
      'Make sure you\'re in the voice channel!\n\n' +
      '⏳ The search will expire after **2 minutes**.\n' +
      'Use `/voicecall hangup` to cancel.',
    )
    .setTimestamp();
}

/**
 * Build a "Call Ended" embed.
 */
export function buildCallEndedEmbed(duration: number, reason: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('📞 Voice Call Ended')
    .setDescription(
      `The voice call has ended.\n\n` +
      `⏱️ Duration: **${formatDuration(duration)}**\n` +
      `📋 Reason: ${reason}`,
    )
    .setTimestamp();
}
