/**
 * Application Emoji Manager
 *
 * Manages a pool of up to 2,000 application-owned emojis with:
 * - Image hash deduplication (same image under different names → one slot)
 * - LRU eviction when pool is full
 * - Redis-backed caching for instant lookups
 * - Progressive reveal for messages with many unknown emojis
 *
 * Usage: Any module (confessions, userphone, quoteboard, etc.) calls
 *   resolveEmojisInText(client, text) and gets back the text with
 *   custom emojis replaced by app emoji references.
 */

import { Client } from 'discord.js';
import { getRedis } from '../database/connection';
import { createModuleLogger } from './logger';
import { createHash } from 'crypto';

const logger = createModuleLogger('EmojiManager');

// ============================================
// Constants
// ============================================

const MAX_APP_EMOJIS = 2000;

// Redis keys
const EMOJI_SOURCE_MAP = 'emoji:source';       // HASH: sourceEmojiId → appEmojiId
const EMOJI_HASH_MAP = 'emoji:hash';           // HASH: imageHash → appEmojiId
const EMOJI_LRU_SET = 'emoji:lru';             // ZSET: appEmojiId → lastUsedTimestamp
const EMOJI_META_PREFIX = 'emoji:meta:';       // STRING: appEmojiId → JSON { name, animated, hash }
const EMOJI_POOL_SIZE = 'emoji:pool:size';     // STRING: current count of app emojis

// Regex to match custom Discord emojis: <:name:id> or <a:name:id>
const CUSTOM_EMOJI_REGEX = /<(a?):(\w+):(\d+)>/g;

// ============================================
// Types
// ============================================

interface ParsedEmoji {
  full: string;        // Full match: <:name:123>
  animated: boolean;
  name: string;
  id: string;
}

interface AppEmojiMeta {
  appEmojiId: string;
  name: string;
  animated: boolean;
  hash: string;
}

interface ResolveResult {
  text: string;
  totalEmojis: number;
  cachedHits: number;
  newUploads: number;
  failed: number;
}

// ============================================
// Parsing
// ============================================

/**
 * Extract all custom emojis from text.
 */
export function parseCustomEmojis(text: string): ParsedEmoji[] {
  const emojis: ParsedEmoji[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  // Reset regex state
  CUSTOM_EMOJI_REGEX.lastIndex = 0;

  while ((match = CUSTOM_EMOJI_REGEX.exec(text)) !== null) {
    const id = match[3];
    if (seen.has(id)) continue;
    seen.add(id);

    emojis.push({
      full: match[0],
      animated: match[1] === 'a',
      name: match[2],
      id,
    });
  }

  return emojis;
}

// ============================================
// Image Downloading & Hashing
// ============================================

/**
 * Download an emoji image from Discord CDN and return its MD5 hash + raw buffer.
 */
async function downloadAndHash(emojiId: string, animated: boolean): Promise<{ hash: string; buffer: Buffer } | null> {
  const ext = animated ? 'gif' : 'png';
  const url = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=128&quality=lossless`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const hash = createHash('md5').update(buffer).digest('hex');

    return { hash, buffer };
  } catch (err: any) {
    logger.error('Failed to download emoji', { emojiId, error: err.message });
    return null;
  }
}

// ============================================
// Discord Application Emoji API
// ============================================

/**
 * Upload an emoji to the bot's application emoji pool.
 */
async function uploadAppEmoji(
  client: Client,
  name: string,
  imageBuffer: Buffer,
  animated: boolean,
): Promise<{ id: string; name: string } | null> {
  const applicationId = client.application?.id;
  if (!applicationId) {
    logger.error('No application ID available');
    return null;
  }

  const mimeType = animated ? 'image/gif' : 'image/png';
  const base64 = imageBuffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64}`;

  // Sanitize name: Discord requires 2-32 chars, alphanumeric + underscores
  const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32).padEnd(2, '_');

  try {
    const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/emojis`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${client.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: safeName, image: dataUri }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      logger.error('Failed to upload app emoji', { status: response.status, body: errorBody });
      return null;
    }

    const data = await response.json() as { id: string; name: string };
    return { id: data.id, name: data.name };
  } catch (err: any) {
    logger.error('Error uploading app emoji', { error: err.message });
    return null;
  }
}

/**
 * Delete an emoji from the bot's application emoji pool.
 */
async function deleteAppEmoji(client: Client, emojiId: string): Promise<boolean> {
  const applicationId = client.application?.id;
  if (!applicationId) return false;

  try {
    const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/emojis/${emojiId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bot ${client.token}`,
      },
    });

    return response.ok || response.status === 204;
  } catch (err: any) {
    logger.error('Error deleting app emoji', { emojiId, error: err.message });
    return false;
  }
}

/**
 * Get the current count of application emojis.
 */
async function getAppEmojiCount(client: Client): Promise<number> {
  const applicationId = client.application?.id;
  if (!applicationId) return 0;

  try {
    const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/emojis`, {
      headers: { Authorization: `Bot ${client.token}` },
    });

    if (!response.ok) return 0;
    const data = await response.json() as { items: any[] };
    return data.items?.length ?? 0;
  } catch {
    return 0;
  }
}

// ============================================
// LRU Eviction
// ============================================

/**
 * Evict the least recently used emoji from the pool.
 */
async function evictLRU(client: Client): Promise<boolean> {
  const redis = getRedis();

  // Get the oldest entry from the LRU sorted set
  const oldest = await redis.zrange(EMOJI_LRU_SET, 0, 0);
  if (oldest.length === 0) return false;

  const evictId = oldest[0];

  // Get metadata to clean up hash mapping
  const metaRaw = await redis.get(`${EMOJI_META_PREFIX}${evictId}`);
  if (metaRaw) {
    const meta: AppEmojiMeta = JSON.parse(metaRaw);
    await redis.hdel(EMOJI_HASH_MAP, meta.hash);
  }

  // Remove from all Redis structures
  await redis.zrem(EMOJI_LRU_SET, evictId);
  await redis.del(`${EMOJI_META_PREFIX}${evictId}`);

  // Find and remove any source ID mappings pointing to this app emoji
  const allSources = await redis.hgetall(EMOJI_SOURCE_MAP);
  for (const [sourceId, appId] of Object.entries(allSources)) {
    if (appId === evictId) {
      await redis.hdel(EMOJI_SOURCE_MAP, sourceId);
    }
  }

  // Delete from Discord API
  await deleteAppEmoji(client, evictId);
  await redis.decr(EMOJI_POOL_SIZE);

  logger.info('Evicted LRU emoji', { evictId });
  return true;
}

// ============================================
// Core Resolution
// ============================================

/**
 * Resolve a single emoji — returns the app emoji string or null if failed.
 */
async function resolveOneEmoji(
  client: Client,
  emoji: ParsedEmoji,
): Promise<string | null> {
  const redis = getRedis();
  const now = Date.now();

  // ── Fast path: source ID already mapped ──
  const cachedAppId = await redis.hget(EMOJI_SOURCE_MAP, emoji.id);
  if (cachedAppId) {
    // Touch LRU
    await redis.zadd(EMOJI_LRU_SET, now, cachedAppId);
    const meta = await redis.get(`${EMOJI_META_PREFIX}${cachedAppId}`);
    if (meta) {
      const parsed: AppEmojiMeta = JSON.parse(meta);
      return `<${parsed.animated ? 'a' : ''}:${parsed.name}:${cachedAppId}>`;
    }
  }

  // ── Slow path: download, hash, check for dupe ──
  const result = await downloadAndHash(emoji.id, emoji.animated);
  if (!result) return null;

  const { hash, buffer } = result;

  // Check if we already have this exact image (different name/ID, same image)
  const hashMatch = await redis.hget(EMOJI_HASH_MAP, hash);
  if (hashMatch) {
    // Map this source ID to the existing app emoji
    await redis.hset(EMOJI_SOURCE_MAP, emoji.id, hashMatch);
    await redis.zadd(EMOJI_LRU_SET, now, hashMatch);
    const meta = await redis.get(`${EMOJI_META_PREFIX}${hashMatch}`);
    if (meta) {
      const parsed: AppEmojiMeta = JSON.parse(meta);
      return `<${parsed.animated ? 'a' : ''}:${parsed.name}:${hashMatch}>`;
    }
  }

  // ── Need to upload a new emoji ──

  // Check pool size — evict if full
  const poolSize = parseInt(await redis.get(EMOJI_POOL_SIZE) || '0', 10);
  if (poolSize >= MAX_APP_EMOJIS) {
    const evicted = await evictLRU(client);
    if (!evicted) {
      logger.warn('Pool full and eviction failed');
      return null;
    }
  }

  // Upload to application emojis
  const uploaded = await uploadAppEmoji(client, emoji.name, buffer, emoji.animated);
  if (!uploaded) return null;

  // Store all mappings
  const meta: AppEmojiMeta = {
    appEmojiId: uploaded.id,
    name: uploaded.name,
    animated: emoji.animated,
    hash,
  };

  await redis.hset(EMOJI_SOURCE_MAP, emoji.id, uploaded.id);
  await redis.hset(EMOJI_HASH_MAP, hash, uploaded.id);
  await redis.set(`${EMOJI_META_PREFIX}${uploaded.id}`, JSON.stringify(meta));
  await redis.zadd(EMOJI_LRU_SET, now, uploaded.id);
  await redis.incr(EMOJI_POOL_SIZE);

  logger.info('Uploaded new app emoji', { sourceId: emoji.id, appId: uploaded.id, name: uploaded.name });

  return `<${emoji.animated ? 'a' : ''}:${uploaded.name}:${uploaded.id}>`;
}

// ============================================
// Public API
// ============================================

/** Threshold for progressive reveal vs instant processing */
const PROGRESSIVE_THRESHOLD = 5;

/**
 * Resolve all custom emojis in a text string.
 *
 * - Cached emojis are swapped instantly
 * - New emojis are uploaded to the app emoji pool
 * - Image hash deduplication prevents duplicate slots
 *
 * Returns the resolved text and stats.
 */
export async function resolveEmojisInText(
  client: Client,
  text: string,
): Promise<ResolveResult> {
  const emojis = parseCustomEmojis(text);

  if (emojis.length === 0) {
    return { text, totalEmojis: 0, cachedHits: 0, newUploads: 0, failed: 0 };
  }

  const redis = getRedis();
  let resolvedText = text;
  let cachedHits = 0;
  let newUploads = 0;
  let failed = 0;

  // Pre-check which ones are already cached for fast stats
  const uncachedEmojis: ParsedEmoji[] = [];
  for (const emoji of emojis) {
    const cached = await redis.hget(EMOJI_SOURCE_MAP, emoji.id);
    if (cached) {
      cachedHits++;
    } else {
      uncachedEmojis.push(emoji);
    }
  }

  // Process all emojis (cached ones are instant via fast path)
  for (const emoji of emojis) {
    const resolved = await resolveOneEmoji(client, emoji);
    if (resolved) {
      resolvedText = resolvedText.replaceAll(emoji.full, resolved);
      if (uncachedEmojis.includes(emoji)) newUploads++;
    } else {
      failed++;
      // Leave as :name: text fallback
      resolvedText = resolvedText.replaceAll(emoji.full, `:${emoji.name}:`);
    }
  }

  return {
    text: resolvedText,
    totalEmojis: emojis.length,
    cachedHits,
    newUploads,
    failed,
  };
}

/**
 * Check if a text has custom emojis that need resolving.
 */
export function hasCustomEmojis(text: string): boolean {
  CUSTOM_EMOJI_REGEX.lastIndex = 0;
  return CUSTOM_EMOJI_REGEX.test(text);
}

/**
 * Get the number of uncached emojis in a text (useful for deciding
 * whether to use progressive reveal).
 */
export async function countUncachedEmojis(text: string): Promise<number> {
  const emojis = parseCustomEmojis(text);
  if (emojis.length === 0) return 0;

  const redis = getRedis();
  let uncached = 0;

  for (const emoji of emojis) {
    const cached = await redis.hget(EMOJI_SOURCE_MAP, emoji.id);
    if (!cached) uncached++;
  }

  return uncached;
}

/**
 * Resolve emojis with progressive reveal support.
 *
 * For messages with <= PROGRESSIVE_THRESHOLD new emojis:
 *   Resolves all at once, returns final text.
 *
 * For messages with > PROGRESSIVE_THRESHOLD new emojis:
 *   Returns cached-only text immediately.
 *   Calls onProgress() with updated text as each batch completes.
 *   Caller should use onProgress to edit the message progressively.
 */
export async function resolveEmojisProgressive(
  client: Client,
  text: string,
  onProgress?: (updatedText: string, done: boolean) => Promise<void>,
): Promise<string> {
  const emojis = parseCustomEmojis(text);
  if (emojis.length === 0) return text;

  const redis = getRedis();
  let resolvedText = text;

  // Separate cached vs uncached
  const cached: ParsedEmoji[] = [];
  const uncached: ParsedEmoji[] = [];

  for (const emoji of emojis) {
    const hit = await redis.hget(EMOJI_SOURCE_MAP, emoji.id);
    if (hit) {
      cached.push(emoji);
    } else {
      uncached.push(emoji);
    }
  }

  // Resolve all cached ones instantly
  for (const emoji of cached) {
    const resolved = await resolveOneEmoji(client, emoji);
    if (resolved) {
      resolvedText = resolvedText.replaceAll(emoji.full, resolved);
    }
  }

  // If few uncached, resolve all at once
  if (uncached.length <= PROGRESSIVE_THRESHOLD || !onProgress) {
    for (const emoji of uncached) {
      const resolved = await resolveOneEmoji(client, emoji);
      if (resolved) {
        resolvedText = resolvedText.replaceAll(emoji.full, resolved);
      } else {
        resolvedText = resolvedText.replaceAll(emoji.full, `:${emoji.name}:`);
      }
    }
    return resolvedText;
  }

  // Progressive reveal: send with cached-only text first
  // Replace uncached ones with :name: temporarily
  let progressText = resolvedText;
  for (const emoji of uncached) {
    progressText = progressText.replaceAll(emoji.full, `:${emoji.name}:`);
  }

  // Send initial version
  await onProgress(progressText, false);

  // Process uncached in batches of 3 (respects Discord edit rate limit of ~5/5s)
  const BATCH_SIZE = 3;
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);

    // Process batch in parallel
    const results = await Promise.all(
      batch.map(async (emoji) => {
        const resolved = await resolveOneEmoji(client, emoji);
        return { emoji, resolved };
      }),
    );

    // Apply results
    for (const { emoji, resolved } of results) {
      if (resolved) {
        resolvedText = resolvedText.replaceAll(emoji.full, resolved);
        progressText = progressText.replaceAll(`:${emoji.name}:`, resolved);
      } else {
        resolvedText = resolvedText.replaceAll(emoji.full, `:${emoji.name}:`);
      }
    }

    const isDone = i + BATCH_SIZE >= uncached.length;
    await onProgress(progressText, isDone);

    // Wait between batches to avoid edit rate limits (2s between edits)
    if (!isDone) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return resolvedText;
}

/**
 * Initialize the pool size counter from Discord API.
 * Call once on bot startup.
 */
export async function initEmojiPool(client: Client): Promise<void> {
  try {
    const count = await getAppEmojiCount(client);
    const redis = getRedis();
    await redis.set(EMOJI_POOL_SIZE, String(count));
    logger.info(`Emoji pool initialized: ${count}/${MAX_APP_EMOJIS} slots used`);
  } catch (err: any) {
    logger.error('Failed to init emoji pool', { error: err.message });
  }
}
