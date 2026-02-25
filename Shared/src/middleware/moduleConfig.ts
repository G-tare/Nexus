import { getDb } from '../database/connection';
import { getRedis } from '../database/connection';
import { guildModuleConfigs, guilds } from '../database/models/schema';
import { eq, and } from 'drizzle-orm';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('ModuleConfig');
const CACHE_TTL = 60; // 1 minute — short TTL to prevent stale enable/disable state

/**
 * Manage per-guild module configurations.
 * Each module stores its config as JSONB, making it flexible for different modules.
 */
export class ModuleConfigManager {
  /**
   * Check if a module is enabled for a guild.
   * Normalises the module name to lowercase to avoid case-sensitive mismatches.
   */
  async isEnabled(guildId: string, moduleName: string): Promise<boolean> {
    const config = await this.getModuleConfig(guildId, moduleName.toLowerCase());
    // Default to enabled when no config row exists (module hasn't been explicitly disabled)
    return config?.enabled ?? true;
  }

  /**
   * Get the full config for a module in a guild.
   */
  async getModuleConfig<T = Record<string, any>>(
    guildId: string,
    moduleName: string
  ): Promise<{ enabled: boolean; config: T } | null> {
    const normalised = moduleName.toLowerCase();
    const redis = getRedis();
    const cacheKey = `modcfg:${guildId}:${normalised}`;

    // Try cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* fall through */ }

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

    // Cache
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch { /* ignore */ }

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
    const newConfig = { ...(existing?.config || {}), ...configUpdate };
    await this.upsertConfig(guildId, normalised, { config: newConfig });
  }

  /**
   * Set the full module configuration.
   */
  async setConfig(guildId: string, moduleName: string, moduleConfig: Record<string, any>): Promise<void> {
    await this.upsertConfig(guildId, moduleName.toLowerCase(), { config: moduleConfig });
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
    const redis = getRedis();
    try {
      const newState = {
        enabled: update.enabled ?? existing?.enabled ?? true,
        config: update.config ?? existing?.config ?? {},
      };
      await redis.setex(`modcfg:${guildId}:${normalised}`, CACHE_TTL, JSON.stringify(newState));
    } catch { /* ignore */ }

    logger.debug('Module config updated', { guildId, moduleName: normalised, update });
  }
}

export const moduleConfig = new ModuleConfigManager();
export default moduleConfig;
