/**
 * TimerManager — Scheduled event manager using setTimeout per item.
 *
 * Replaces Redis polling loops (setInterval + KEYS/ZRANGEBYSCORE) with
 * per-item setTimeout callbacks. Zero Redis commands while waiting.
 *
 * Used for: tempbans, reminders, delayed auto-roles, XP boost expiry, lockdowns.
 *
 * On bot startup, pending items are loaded from Postgres and scheduled.
 * When a new item is created at runtime, it's scheduled immediately.
 * If the bot restarts, all timers are reconstructed from Postgres (source of truth).
 */

import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('TimerManager');

/** Maximum safe setTimeout delay (~24.8 days). Beyond this, we re-schedule. */
const MAX_TIMEOUT_MS = 2_147_483_647;

export class TimerManager {
  private timers = new Map<string, NodeJS.Timeout>();
  private callbacks = new Map<string, () => Promise<void>>();

  /**
   * Schedule a callback to execute at a specific time.
   * If executeAt is in the past, fires immediately (setTimeout(0)).
   * For very long delays (>24.8 days), uses chained timeouts.
   */
  schedule(id: string, executeAt: Date, callback: () => Promise<void>): void {
    // Cancel any existing timer for this ID
    this.cancel(id);

    const delayMs = Math.max(0, executeAt.getTime() - Date.now());

    // Store callback for potential re-scheduling
    this.callbacks.set(id, callback);

    if (delayMs > MAX_TIMEOUT_MS) {
      // Chain: schedule a wake-up at MAX_TIMEOUT_MS, then re-evaluate
      const timer = setTimeout(() => {
        this.timers.delete(id);
        // Re-schedule for the remaining time
        this.schedule(id, executeAt, callback);
      }, MAX_TIMEOUT_MS);
      timer.unref();
      this.timers.set(id, timer);
    } else {
      const timer = setTimeout(async () => {
        this.timers.delete(id);
        this.callbacks.delete(id);
        try {
          await callback();
        } catch (err: any) {
          logger.error(`Timer callback failed: ${id}`, { error: err.message });
        }
      }, delayMs);
      timer.unref();
      this.timers.set(id, timer);
    }
  }

  /**
   * Cancel a scheduled timer.
   */
  cancel(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.callbacks.delete(id);
  }

  /**
   * Check if a timer is currently scheduled.
   */
  has(id: string): boolean {
    return this.timers.has(id);
  }

  /**
   * Load pending items from a data source and schedule them.
   * Used on bot startup to reconstruct timers from Postgres.
   *
   * @param type Label for logging (e.g., 'tempban', 'reminder')
   * @param query Function that returns pending items with their IDs and execution times
   * @param callbackFactory Function that creates the callback for each item
   */
  async loadFromSource(
    type: string,
    query: () => Promise<Array<{ id: string; executeAt: Date }>>,
    callbackFactory: (id: string) => () => Promise<void>,
  ): Promise<number> {
    try {
      const items = await query();
      let scheduled = 0;

      for (const item of items) {
        this.schedule(item.id, item.executeAt, callbackFactory(item.id));
        scheduled++;
      }

      if (scheduled > 0) {
        logger.info(`Loaded ${scheduled} pending ${type} timer(s)`);
      }

      return scheduled;
    } catch (err: any) {
      logger.error(`Failed to load ${type} timers from source`, { error: err.message });
      return 0;
    }
  }

  /**
   * Number of active timers.
   */
  activeCount(): number {
    return this.timers.size;
  }

  /**
   * Clear all timers.
   */
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.callbacks.clear();
  }
}

/** Singleton timer manager — shared across the entire bot process. */
export const timers = new TimerManager();
