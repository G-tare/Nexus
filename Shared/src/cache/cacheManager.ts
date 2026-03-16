/**
 * CacheManager — In-memory cache with TTL, Set, SortedSet, and Counter support.
 *
 * Replaces ~90% of Redis usage with zero-cost in-memory operations.
 * Guild-scoped data is safe to cache in-memory even with sharding,
 * because Discord guarantees each guild lives on exactly one shard.
 *
 * What stays in Redis:
 *   - Emoji LRU pool (cross-shard shared state)
 *   - Guild cache for API (cross-process: API ↔ bot)
 *   - Pub/sub invalidation channel
 */

import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('CacheManager');

interface CacheEntry {
  value: unknown;
  expiresAt: number | null; // Unix ms, null = no expiry
}

interface SortedSetEntry {
  score: number;
  member: string;
}

export class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private sets = new Map<string, Set<string>>();
  private sortedSets = new Map<string, SortedSetEntry[]>();
  private ttlTimers = new Map<string, NodeJS.Timeout>();

  // ── String/Object operations ──

  get<T = unknown>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
      this.del(key);
      return null;
    }

    return entry.value as T;
  }

  set(key: string, value: unknown, ttlSeconds?: number): void {
    // Clear any existing TTL timer
    this.clearTimer(key);

    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiresAt });

    if (ttlSeconds && ttlSeconds > 0) {
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.ttlTimers.delete(key);
      }, ttlSeconds * 1000);
      timer.unref(); // Don't prevent process exit
      this.ttlTimers.set(key, timer);
    }
  }

  del(key: string): void {
    this.cache.delete(key);
    this.sets.delete(key);
    this.sortedSets.delete(key);
    this.clearTimer(key);
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return this.sets.has(key) || this.sortedSets.has(key);

    if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
      this.del(key);
      return false;
    }
    return true;
  }

  /**
   * Set expiry on an existing key (seconds).
   */
  expire(key: string, ttlSeconds: number): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
      this.clearTimer(key);
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.ttlTimers.delete(key);
      }, ttlSeconds * 1000);
      timer.unref();
      this.ttlTimers.set(key, timer);
    }
    // Also handle sets and sorted sets
    if (this.sets.has(key) || this.sortedSets.has(key)) {
      this.clearTimer(key);
      const timer = setTimeout(() => {
        this.sets.delete(key);
        this.sortedSets.delete(key);
        this.ttlTimers.delete(key);
      }, ttlSeconds * 1000);
      timer.unref();
      this.ttlTimers.set(key, timer);
    }
  }

  // ── Set operations (for shadowban, autokick, user reminders, etc.) ──

  sadd(key: string, ...members: string[]): void {
    let set = this.sets.get(key);
    if (!set) {
      set = new Set();
      this.sets.set(key, set);
    }
    for (const m of members) set.add(m);
  }

  srem(key: string, ...members: string[]): void {
    const set = this.sets.get(key);
    if (!set) return;
    for (const m of members) set.delete(m);
    if (set.size === 0) this.sets.delete(key);
  }

  sismember(key: string, member: string): boolean {
    return this.sets.get(key)?.has(member) ?? false;
  }

  smembers(key: string): string[] {
    const set = this.sets.get(key);
    return set ? [...set] : [];
  }

  // ── Counter operations (for automod nuke detection, rate limits) ──

  incr(key: string, ttlSeconds?: number): number {
    const entry = this.cache.get(key);
    let current = 0;

    if (entry) {
      if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
        this.del(key);
      } else {
        current = entry.value as number;
      }
    }

    current++;
    this.set(key, current, ttlSeconds);
    return current;
  }

  /**
   * Increment with millisecond TTL precision (for automod pexpire pattern).
   */
  pincr(key: string, ttlMs?: number): number {
    const entry = this.cache.get(key);
    let current = 0;

    if (entry) {
      if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
        this.del(key);
      } else {
        current = entry.value as number;
      }
    }

    current++;

    this.clearTimer(key);
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    this.cache.set(key, { value: current, expiresAt });

    if (ttlMs && ttlMs > 0) {
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.ttlTimers.delete(key);
      }, ttlMs);
      timer.unref();
      this.ttlTimers.set(key, timer);
    }

    return current;
  }

  // ── Sorted set operations (for automod joins, delayed roles, reminders) ──

  zadd(key: string, score: number, member: string): void {
    let ss = this.sortedSets.get(key);
    if (!ss) {
      ss = [];
      this.sortedSets.set(key, ss);
    }

    // Remove existing entry for this member
    const idx = ss.findIndex(e => e.member === member);
    if (idx >= 0) ss.splice(idx, 1);

    // Insert sorted by score
    const insertIdx = ss.findIndex(e => e.score > score);
    if (insertIdx === -1) {
      ss.push({ score, member });
    } else {
      ss.splice(insertIdx, 0, { score, member });
    }
  }

  zrangebyscore(key: string, min: number, max: number): string[] {
    const ss = this.sortedSets.get(key);
    if (!ss) return [];
    return ss.filter(e => e.score >= min && e.score <= max).map(e => e.member);
  }

  zrem(key: string, ...members: string[]): void {
    const ss = this.sortedSets.get(key);
    if (!ss) return;
    const memberSet = new Set(members);
    const filtered = ss.filter(e => !memberSet.has(e.member));
    if (filtered.length === 0) {
      this.sortedSets.delete(key);
    } else {
      this.sortedSets.set(key, filtered);
    }
  }

  zremrangebyscore(key: string, min: number, max: number): void {
    const ss = this.sortedSets.get(key);
    if (!ss) return;
    const filtered = ss.filter(e => e.score < min || e.score > max);
    if (filtered.length === 0) {
      this.sortedSets.delete(key);
    } else {
      this.sortedSets.set(key, filtered);
    }
  }

  zcard(key: string): number {
    return this.sortedSets.get(key)?.length ?? 0;
  }

  // ── Hash operations (for reminder data) ──

  hset(key: string, fieldOrObj: string | Record<string, string>, value?: string): void {
    let hash = this.cache.get(key)?.value as Record<string, string> | undefined;
    if (!hash || typeof hash !== 'object') {
      hash = {};
    }

    if (typeof fieldOrObj === 'string') {
      hash[fieldOrObj] = value!;
    } else {
      Object.assign(hash, fieldOrObj);
    }

    this.cache.set(key, { value: hash, expiresAt: this.cache.get(key)?.expiresAt ?? null });
  }

  hget(key: string, field: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
      this.del(key);
      return null;
    }
    const hash = entry.value as Record<string, string>;
    return hash?.[field] ?? null;
  }

  hgetall(key: string): Record<string, string> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
      this.del(key);
      return null;
    }
    const hash = entry.value as Record<string, string>;
    if (!hash || typeof hash !== 'object') return null;
    return { ...hash };
  }

  // ── Bulk operations ──

  /**
   * Delete all keys matching a prefix. Replaces redis.keys(pattern) + redis.del().
   * Free, instant, no network calls.
   */
  deleteByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.del(key);
        count++;
      }
    }
    for (const key of this.sets.keys()) {
      if (key.startsWith(prefix)) {
        this.sets.delete(key);
        this.clearTimer(key);
        count++;
      }
    }
    for (const key of this.sortedSets.keys()) {
      if (key.startsWith(prefix)) {
        this.sortedSets.delete(key);
        this.clearTimer(key);
        count++;
      }
    }
    return count;
  }

  // ── Stats ──

  size(): number {
    return this.cache.size + this.sets.size + this.sortedSets.size;
  }

  clear(): void {
    for (const timer of this.ttlTimers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.sets.clear();
    this.sortedSets.clear();
    this.ttlTimers.clear();
  }

  // ── Internal ──

  private clearTimer(key: string): void {
    const timer = this.ttlTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.ttlTimers.delete(key);
    }
  }
}

/** Singleton cache instance — shared across the entire bot process. */
export const cache = new CacheManager();
