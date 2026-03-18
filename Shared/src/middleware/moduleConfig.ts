import { getDb } from '../database/connection';
import { getPool } from '../database/connection';
import { cache } from '../cache/cacheManager';
import { guildModuleConfigs, guilds } from '../database/models/schema';
import { eq, and } from 'drizzle-orm';
import { createModuleLogger } from '../utils/logger';
import { eventBus } from '../events/eventBus';

const logger = createModuleLogger('ModuleConfig');
// Primary invalidation is event-driven via Redis pub/sub.
// TTL is a safety-net fallback in case a pub/sub message is missed.
const CACHE_TTL = 15; // 15 seconds fallback
const GLOBAL_TOGGLE_CACHE_TTL = 15; // 15 seconds fallback
const SERVER_BAN_CACHE_TTL = 15; // 15 seconds fallback

/**
 * Modules that should be DISABLED by default (opt-in rather than opt-out).
 * All other modules default to enabled.
 */
const DISABLED_BY_DEFAULT = new Set([
  'automod',
]);

/**
 * Manage per-guild module configurations.
 * Each module stores its config as JSONB, making it flexible for different modules.
 */
export interface ModuleStatus {
  enabled: boolean;
  globallyDisabled?: boolean;
  serverBanned?: boolean;
  reason?: string;
  reasonDetail?: string;
}

export class ModuleConfigManager {
  /**
   * Check if a module is enabled for a guild.
   * Hierarchy: global disable > server ban > server config > global enable.
   * Normalises the module name to lowercase to avoid case-sensitive mismatches.
   */
  async isEnabled(guildId: string, moduleName: string): Promise<boolean> {
    const status = await this.getModuleStatus(guildId, moduleName);
    return status.enabled;
  }

  /**
   * Get detailed module status including global toggles and server bans.
   * Returns reason information for UI display.
   */
  async getModuleStatus(guildId: string, moduleName: string): Promise<ModuleStatus> {
    const normalName = moduleName.toLowerCase();

    // 1. Check global toggle — if globally disabled, overrides everything
    const globalToggle = await this.getGlobalToggle(normalName);
    if (globalToggle && !globalToggle.enabled) {
      return {
        enabled: false,
        globallyDisabled: true,
        reason: globalToggle.reason || undefined,
        reasonDetail: globalToggle.reason_detail || undefined,
      };
    }

    // 2. Check server-specific ban — overrides server config
    const serverBan = await this.getServerBan(guildId, normalName);
    if (serverBan) {
      return {
        enabled: false,
        serverBanned: true,
        reason: serverBan.reason || undefined,
        reasonDetail: serverBan.reason_detail || undefined,
      };
    }

    // 3. Check server config (existing logic)
    const config = await this.getModuleConfig(guildId, normalName);
    if (!config) return { enabled: !DISABLED_BY_DEFAULT.has(normalName) };
    return { enabled: config.enabled };
  }

  /**
   * Get global toggle state for a module. Returns null if no toggle exists (defaults to enabled).
   */
  async getGlobalToggle(moduleName: string): Promise<{ enabled: boolean; reason: string | null; reason_detail: string | null } | null> {
    const cacheKey = `globaltoggle:${moduleName}`;

    // Try in-memory cache
    const cached = cache.get<string>(cacheKey);
    if (cached !== null) {
      return cached === 'null' ? null : JSON.parse(cached as string);
    }

    // Query DB
    const pool = getPool();
    const result = await pool.query(
      'SELECT enabled, reason, reason_detail FROM global_module_toggles WHERE module_name = $1',
      [moduleName],
    );

    if (!result.rows[0]) {
      cache.set(cacheKey, 'null', GLOBAL_TOGGLE_CACHE_TTL);
      return null;
    }

    const toggle = result.rows[0];
    cache.set(cacheKey, JSON.stringify(toggle), GLOBAL_TOGGLE_CACHE_TTL);

    return toggle;
  }

  /**
   * Get server-specific module ban. Returns null if not banned.
   */
  async getServerBan(guildId: string, moduleName: string): Promise<{ reason: string | null; reason_detail: string | null } | null> {
    const cacheKey = `serverban:${guildId}:${moduleName}`;

    // Try in-memory cache
    const cached = cache.get<string>(cacheKey);
    if (cached !== null) {
      return cached === 'null' ? null : JSON.parse(cached as string);
    }

    // Query DB
    const pool = getPool();
    const result = await pool.query(
      'SELECT reason, reason_detail FROM server_module_bans WHERE guild_id = $1 AND module_name = $2',
      [guildId, moduleName],
    );

    if (!result.rows[0]) {
      cache.set(cacheKey, 'null', SERVER_BAN_CACHE_TTL);
      return null;
    }

    const ban = result.rows[0];
    cache.set(cacheKey, JSON.stringify(ban), SERVER_BAN_CACHE_TTL);

    return ban;
  }

  /**
   * Invalidate global toggle cache for a module (called after toggle change).
   */
  async invalidateGlobalToggle(moduleName: string): Promise<void> {
    cache.del(`globaltoggle:${moduleName.toLowerCase()}`);
  }

  /**
   * Invalidate server ban cache (called after ban change).
   */
  async invalidateServerBan(guildId: string, moduleName: string): Promise<void> {
    cache.del(`serverban:${guildId}:${moduleName.toLowerCase()}`);
  }

  /**
   * Get the full config for a module in a guild.
   */
  async getModuleConfig<T = Record<string, any>>(
    guildId: string,
    moduleName: string
  ): Promise<{ enabled: boolean; config: T } | null> {
    const normalised = moduleName.toLowerCase();
    const cacheKey = `modcfg:${guildId}:${normalised}`;

    // Try in-memory cache
    const cached = cache.get<{ enabled: boolean; config: T }>(cacheKey);
    if (cached !== null) return cached;

    // Query DB
    const db = getDb();
    const [row] = await db.select()
      .from(guildModuleConfigs)
      .where(
        and(
          eq(guildModuleConfigs.guildId, guildId),
          eq(guildModuleConfigs.module, normalised)
        )
      )
      .limit(1);

    if (!row) return null;

    const result = { enabled: row.enabled, config: row.config as T };

    // Cache in memory
    cache.set(cacheKey, result, CACHE_TTL);

    return result;
  }

  /**
   * Set module enabled/disabled.
   */
  async setEnabled(guildId: string, moduleName: string, enabled: boolean): Promise<void> {
    await this.upsertConfig(guildId, moduleName.toLowerCase(), { enabled });
  }

  /**
   * Update module configuration (partial update, merges with existing).
   */
  async updateConfig(guildId: string, moduleName: string, configUpdate: Record<string, any>): Promise<void> {
    const normalised = moduleName.toLowerCase();
    const existing = await this.getModuleConfig(guildId, normalised);
    // Deep-clone the old config so callers who mutated the cached reference
    // don't make oldConfig === newConfig (which breaks change detection in listeners)
    const oldConfig = JSON.parse(JSON.stringify((existing?.config || {}))) as Record<string, any>;
    const newConfig = { ...oldConfig, ...configUpdate };
    await this.upsertConfig(guildId, normalised, { config: newConfig });
    eventBus.emit('configUpdated', { guildId, moduleName: normalised, oldConfig, newConfig });
  }

  /**
   * Set the full module configuration.
   */
  async setConfig(guildId: string, moduleName: string, moduleConfig: Record<string, any>): Promise<void> {
    await this.upsertConfig(guildId, moduleName.toLowerCase(), { config: moduleConfig });
  }

  /**
   * Check if a specific command is disabled within a module for a guild.
   * Uses the `disabledCommands` array stored in the module's JSONB config.
   */
  async isCommandDisabled(guildId: string, moduleName: string, commandName: string): Promise<boolean> {
    const config = await this.getModuleConfig(guildId, moduleName.toLowerCase());
    if (!config) return false;
    const disabled: string[] = (config.config as Record<string, any>).disabledCommands || [];
    return disabled.includes(commandName);
  }

  /**
   * Enable or disable a specific command within a module for a guild.
   */
  async setCommandDisabled(guildId: string, moduleName: string, commandName: string, disabled: boolean): Promise<void> {
    const normalised = moduleName.toLowerCase();
    const existing = await this.getModuleConfig(guildId, normalised);
    const existingConfig = (existing?.config || {}) as Record<string, any>;
    const disabledCommands: string[] = existingConfig.disabledCommands || [];

    let updated: string[];
    if (disabled) {
      updated = disabledCommands.includes(commandName) ? disabledCommands : [...disabledCommands, commandName];
    } else {
      updated = disabledCommands.filter((c: string) => c !== commandName);
    }

    await this.upsertConfig(guildId, normalised, { config: { ...existingConfig, disabledCommands: updated } });
  }

  /**
   * Get all module configs for a guild (for dashboard).
   */
  async getAllConfigs(guildId: string): Promise<Record<string, { enabled: boolean; config: any }>> {
    const db = getDb();
    const rows = await db.select()
      .from(guildModuleConfigs)
      .where(eq(guildModuleConfigs.guildId, guildId));

    const result: Record<string, { enabled: boolean; config: any }> = {};
    for (const row of rows) {
      result[row.module] = { enabled: row.enabled, config: row.config };
    }
    return result;
  }

  /**
   * Internal upsert helper.
   */
  private async upsertConfig(
    guildId: string,
    moduleName: string,
    update: { enabled?: boolean; config?: Record<string, any> }
  ): Promise<void> {
    const db = getDb();
    const normalised = moduleName.toLowerCase();

    // Skip cache for the DB read — go directly to DB to avoid stale state
    const [existing] = await db.select()
      .from(guildModuleConfigs)
      .where(
        and(
          eq(guildModuleConfigs.guildId, guildId),
          eq(guildModuleConfigs.module, normalised)
        )
      )
      .limit(1);

    if (existing) {
      const setValues: Record<string, any> = { updatedAt: new Date() };
      if (update.enabled !== undefined) setValues.enabled = update.enabled;
      if (update.config !== undefined) setValues.config = update.config;

      await db.update(guildModuleConfigs)
        .set(setValues)
        .where(
          and(
            eq(guildModuleConfigs.guildId, guildId),
            eq(guildModuleConfigs.module, normalised)
          )
        );
    } else {
      await db.insert(guildModuleConfigs).values({
        guildId,
        module: normalised,
        enabled: update.enabled ?? true,
        config: update.config ?? {},
      });
    }

    // Invalidate cache and immediately set the new value
    const newState = {
      enabled: update.enabled ?? existing?.enabled ?? true,
      config: update.config ?? existing?.config ?? {},
    };
    cache.set(`modcfg:${guildId}:${normalised}`, newState, CACHE_TTL);

    logger.debug('Module config updated', { guildId, moduleName: normalised, update });
  }
}

export const moduleConfig = new ModuleConfigManager();
export default moduleConfig;
