import { getDb } from '../database/connection';
import { getRedis } from '../database/connection';
import { guildModuleConfigs, guilds } from '../database/models/schema';
import { eq, and } from 'drizzle-orm';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('ModuleConfig');
const CACHE_TTL = 300; // 5 minutes

/**
 * Manage per-guild module configurations.
 * Each module stores its config as JSONB, making it flexible for different modules.
 */
export class ModuleConfigManager {
  /**
   * Check if a module is enabled for a guild.
   */
  async isEnabled(guildId: string, moduleName: string): Promise<boolean> {
    const config = await this.getModuleConfig(guildId, moduleName);
    return config?.enabled ?? false;
  }

  /**
   * Get the full config for a module in a guild.
   */
  async getModuleConfig<T = Record<string, any>>(
    guildId: string,
    moduleName: string
  ): Promise<{ enabled: boolean; config: T } | null> {
    const redis = getRedis();
    const cacheKey = `modcfg:${guildId}:${moduleName}`;

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
          eq(guildModuleConfigs.module, moduleName)
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
    await this.upsertConfig(guildId, moduleName, { enabled });
  }

  /**
   * Update module configuration (partial update, merges with existing).
   */
  async updateConfig(guildId: string, moduleName: string, configUpdate: Record<string, any>): Promise<void> {
    const existing = await this.getModuleConfig(guildId, moduleName);
    const newConfig = { ...(existing?.config || {}), ...configUpdate };
    await this.upsertConfig(guildId, moduleName, { config: newConfig });
  }

  /**
   * Set the full module configuration.
   */
  async setConfig(guildId: string, moduleName: string, moduleConfig: Record<string, any>): Promise<void> {
    await this.upsertConfig(guildId, moduleName, { config: moduleConfig });
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
    const existing = await this.getModuleConfig(guildId, moduleName);

    if (existing) {
      const setValues: Record<string, any> = { updatedAt: new Date() };
      if (update.enabled !== undefined) setValues.enabled = update.enabled;
      if (update.config !== undefined) setValues.config = update.config;

      await db.update(guildModuleConfigs)
        .set(setValues)
        .where(
          and(
            eq(guildModuleConfigs.guildId, guildId),
            eq(guildModuleConfigs.module, moduleName)
          )
        );
    } else {
      await db.insert(guildModuleConfigs).values({
        guildId,
        module: moduleName,
        enabled: update.enabled ?? false,
        config: update.config ?? {},
      });
    }

    // Invalidate cache
    const redis = getRedis();
    try {
      await redis.del(`modcfg:${guildId}:${moduleName}`);
    } catch { /* ignore */ }

    logger.debug('Module config updated', { guildId, moduleName, update });
  }
}

export const moduleConfig = new ModuleConfigManager();
export default moduleConfig;
