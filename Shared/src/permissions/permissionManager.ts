import { GuildMember, PermissionsBitField, PermissionResolvable, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { getDb } from '../database/connection';
import { commandPermissions } from '../database/models/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { cache } from '../cache/cacheManager';
import { createModuleLogger } from '../utils/logger';
import { config } from '../config';

const logger = createModuleLogger('Permissions');

/**
 * Permission Priority (highest to lowest):
 * 1. User-specific DENY  → Always blocks
 * 2. User-specific ALLOW → Overrides role-level
 * 3. Role-specific DENY  → Blocks unless user-level override
 * 4. Role-specific ALLOW → Grants access
 * 5. Channel-specific rules
 * 6. Default Discord permissions
 * 7. Everyone fallback
 */

interface PermissionRule {
  targetType: 'role' | 'user' | 'channel';
  targetId: string;
  allowed: boolean;
}

const CACHE_TTL = 15; // 15 seconds fallback (primary invalidation via Redis pub/sub)

export class PermissionManager {
  /**
   * Check if a member can use a specific command.
   * @param interaction The command interaction
   * @param commandPath Permission path (e.g., "moderation.ban", "fun.8ball")
   * @param defaultPermissions Discord permissions required when no custom rules exist
   */
  async canUse(
    interaction: ChatInputCommandInteraction,
    commandPath: string,
    defaultPermissions?: PermissionResolvable | null,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const member = interaction.member as GuildMember;
    const guildId = interaction.guildId!;
    const userId = member?.id ?? interaction.user.id;
    const channelId = interaction.channelId!;

    // Bot owners (developers) always have access — cannot be overridden
    if (config.discord.ownerIds.includes(userId)) {
      return { allowed: true };
    }

    // Guild owner always has access
    if (member?.guild?.ownerId === userId) {
      return { allowed: true };
    }

    // Get permission rules for this command
    const rules = await this.getPermissionRules(guildId, commandPath);

    // If no custom rules, fall back to default Discord permissions
    if (rules.length === 0) {
      return this.checkDefaultPermissions(member, defaultPermissions);
    }

    // ──────────────────────────────────────────────────────────────
    // Priority 1: User-specific DENY — highest priority, always blocks
    // ──────────────────────────────────────────────────────────────
    const userDeny = rules.find(r => r.targetType === 'user' && r.targetId === userId && !r.allowed);
    if (userDeny) {
      return { allowed: false, reason: 'You have been specifically denied access to this command.' };
    }

    // ──────────────────────────────────────────────────────────────
    // Priority 2: User-specific ALLOW — overrides all role/channel restrictions
    // ──────────────────────────────────────────────────────────────
    const userAllow = rules.find(r => r.targetType === 'user' && r.targetId === userId && r.allowed);
    if (userAllow) {
      return { allowed: true };
    }

    // ──────────────────────────────────────────────────────────────
    // Priority 3: Channel whitelist — if ANY allowed channels are set,
    // the command can ONLY be used in those channels. All others are
    // implicitly denied. Explicit channel deny rules still work too.
    // ──────────────────────────────────────────────────────────────
    const channelDeny = rules.find(r =>
      r.targetType === 'channel' && r.targetId === channelId && !r.allowed
    );
    if (channelDeny) {
      return { allowed: false, reason: 'This command cannot be used in this channel.' };
    }

    const allowedChannels = rules.filter(r => r.targetType === 'channel' && r.allowed);
    if (allowedChannels.length > 0) {
      const inAllowedChannel = allowedChannels.some(r => r.targetId === channelId);
      if (!inAllowedChannel) {
        return { allowed: false, reason: 'This command can only be used in designated channels.' };
      }
    }

    // ──────────────────────────────────────────────────────────────
    // Priority 4: Role deny — blocks the user
    // ──────────────────────────────────────────────────────────────
    const memberRoleIds = member.roles.cache.map(r => r.id);

    const roleDeny = rules.find(r =>
      r.targetType === 'role' && memberRoleIds.includes(r.targetId) && !r.allowed
    );
    if (roleDeny) {
      return { allowed: false, reason: 'Your role does not have permission to use this command.' };
    }

    // ──────────────────────────────────────────────────────────────
    // Priority 5: Role whitelist — if ANY allowed roles are set,
    // ONLY members with those roles can use the command. All other
    // roles are implicitly denied. If the member has an allowed
    // role, they pass.
    // ──────────────────────────────────────────────────────────────
    const allowedRoles = rules.filter(r => r.targetType === 'role' && r.allowed);
    if (allowedRoles.length > 0) {
      const hasAllowedRole = allowedRoles.some(r => memberRoleIds.includes(r.targetId));
      if (hasAllowedRole) {
        return { allowed: true };
      }
      // Member has none of the allowed roles → implicit deny
      return { allowed: false, reason: 'You do not have a role that is allowed to use this command.' };
    }

    // ──────────────────────────────────────────────────────────────
    // Priority 6: Fall back to default Discord permissions
    // ──────────────────────────────────────────────────────────────
    return this.checkDefaultPermissions(member, defaultPermissions);
  }

  /**
   * Check default Discord permissions for a member.
   * Administrator always passes. Returns allow if no default permissions required.
   */
  private checkDefaultPermissions(
    member: GuildMember,
    defaultPermissions?: PermissionResolvable | null,
  ): { allowed: boolean; reason?: string } {
    if (!defaultPermissions) {
      return { allowed: true };
    }

    const memberPerms = member.permissions;
    if (memberPerms.has(PermissionFlagsBits.Administrator)) {
      return { allowed: true };
    }

    const hasPerms = memberPerms.has(defaultPermissions);
    if (!hasPerms) {
      const required = new PermissionsBitField(defaultPermissions);
      const missing = required.toArray().filter(p =>
        !memberPerms.has(PermissionFlagsBits[p as keyof typeof PermissionFlagsBits])
      );
      return {
        allowed: false,
        reason: `You need the following permission(s): ${missing.join(', ')}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Get permission rules for a command in a guild, with in-memory caching.
   */
  private async getPermissionRules(guildId: string, commandPath: string): Promise<PermissionRule[]> {
    const cacheKey = `perms:${guildId}:${commandPath}`;

    // Try in-memory cache
    const cached = cache.get<PermissionRule[]>(cacheKey);
    if (cached !== null) return cached;

    // Build command name match condition.
    // The dashboard may have saved the full path ("moderation.ban") or
    // just the short name ("ban"). We check for both so rules always apply.
    const shortName = commandPath.includes('.') ? commandPath.split('.').slice(1).join('.') : null;

    // Query DB — match full path OR short name
    const db = getDb();
    const commandMatch = shortName
      ? or(eq(commandPermissions.command, commandPath), eq(commandPermissions.command, shortName))
      : eq(commandPermissions.command, commandPath);

    const rows = await db.select()
      .from(commandPermissions)
      .where(
        and(
          eq(commandPermissions.guildId, guildId),
          commandMatch!
        )
      );

    const rules: PermissionRule[] = rows.map(row => ({
      targetType: row.targetType as 'role' | 'user' | 'channel',
      targetId: row.targetId,
      allowed: row.allowed,
    }));

    // Cache in memory
    cache.set(cacheKey, rules, CACHE_TTL);

    return rules;
  }

  /**
   * Set a permission rule for a command.
   */
  async setPermission(
    guildId: string,
    commandPath: string,
    targetType: 'role' | 'user' | 'channel',
    targetId: string,
    allowed: boolean
  ): Promise<void> {
    const db = getDb();

    // Upsert: delete existing rule for this target, then insert
    await db.delete(commandPermissions).where(
      and(
        eq(commandPermissions.guildId, guildId),
        eq(commandPermissions.command, commandPath),
        eq(commandPermissions.targetId, targetId)
      )
    );

    await db.insert(commandPermissions).values({
      guildId,
      command: commandPath,
      targetType,
      targetId,
      allowed,
    });

    // Invalidate in-memory cache — clear both full path and short name keys
    this.invalidatePermCache(guildId, commandPath);

    logger.info('Permission updated', { guildId, commandPath, targetType, targetId, allowed });
  }

  /**
   * Remove a permission rule.
   */
  async removePermission(
    guildId: string,
    commandPath: string,
    targetId: string
  ): Promise<void> {
    const db = getDb();

    await db.delete(commandPermissions).where(
      and(
        eq(commandPermissions.guildId, guildId),
        eq(commandPermissions.command, commandPath),
        eq(commandPermissions.targetId, targetId)
      )
    );

    // Invalidate in-memory cache — clear both full path and short name keys
    this.invalidatePermCache(guildId, commandPath);
  }

  /**
   * Get all permission rules for a guild (for dashboard).
   */
  async getGuildPermissions(guildId: string): Promise<Record<string, PermissionRule[]>> {
    const db = getDb();
    const rows = await db.select()
      .from(commandPermissions)
      .where(eq(commandPermissions.guildId, guildId));

    const grouped: Record<string, PermissionRule[]> = {};
    for (const row of rows) {
      if (!grouped[row.command]) {
        grouped[row.command] = [];
      }
      grouped[row.command].push({
        targetType: row.targetType as 'role' | 'user' | 'channel',
        targetId: row.targetId,
        allowed: row.allowed,
      });
    }

    return grouped;
  }

  /**
   * Clear all cached permissions for a guild (call after bulk updates).
   * Uses deleteByPrefix instead of redis.keys() — instant, free.
   */
  async clearGuildCache(guildId: string): Promise<void> {
    cache.deleteByPrefix(`perms:${guildId}:`);
  }

  /**
   * Invalidate permission cache for a command — clears both the full path
   * key ("moderation.ban") and the short name key ("ban") since either
   * format may have been used as the lookup key.
   */
  private invalidatePermCache(guildId: string, commandPath: string): void {
    cache.del(`perms:${guildId}:${commandPath}`);
    // Also clear the full-path key if commandPath is just the short name,
    // or the short-name key if commandPath is the full path.
    // Since we don't know the module prefix from a short name, just wipe
    // all permission caches for this guild — fast and safe.
    cache.deleteByPrefix(`perms:${guildId}:`);
  }
}

export const permissionManager = new PermissionManager();
export default permissionManager;
