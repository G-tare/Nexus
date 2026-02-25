import { GuildMember, PermissionsBitField, PermissionResolvable, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { getDb } from '../database/connection';
import { commandPermissions } from '../database/models/schema';
import { eq, and } from 'drizzle-orm';
import { getRedis } from '../database/connection';
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

const CACHE_TTL = 300; // 5 minutes

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

    // Bot owners always have access
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
      if (defaultPermissions) {
        const memberPerms = member.permissions;
        // Administrator always passes any permission check
        if (memberPerms.has(PermissionFlagsBits.Administrator)) {
          return { allowed: true };
        }
        const hasPerms = memberPerms.has(defaultPermissions);
        if (!hasPerms) {
          // Build a human-readable list of missing permissions
          const required = new PermissionsBitField(defaultPermissions);
          const missing = required.toArray().filter(p => !memberPerms.has(PermissionFlagsBits[p as keyof typeof PermissionFlagsBits]));
          return {
            allowed: false,
            reason: `You need the following permission(s): ${missing.join(', ')}`,
          };
        }
      }
      return { allowed: true }; // No rules and no default perms → allow
    }

    // Priority 1: User-specific DENY
    const userDeny = rules.find(r => r.targetType === 'user' && r.targetId === userId && !r.allowed);
    if (userDeny) {
      return { allowed: false, reason: 'You have been specifically denied access to this command.' };
    }

    // Priority 2: User-specific ALLOW
    const userAllow = rules.find(r => r.targetType === 'user' && r.targetId === userId && r.allowed);
    if (userAllow) {
      return { allowed: true };
    }

    // Priority 3 & 4: Role-based rules
    const memberRoleIds = member.roles.cache.map(r => r.id);

    // Check for any role DENY
    const roleDeny = rules.find(r =>
      r.targetType === 'role' && memberRoleIds.includes(r.targetId) && !r.allowed
    );
    if (roleDeny) {
      return { allowed: false, reason: 'Your role does not have permission to use this command.' };
    }

    // Check for any role ALLOW
    const roleAllow = rules.find(r =>
      r.targetType === 'role' && memberRoleIds.includes(r.targetId) && r.allowed
    );
    if (roleAllow) {
      return { allowed: true };
    }

    // Priority 5: Channel-based rules
    const channelDeny = rules.find(r =>
      r.targetType === 'channel' && r.targetId === channelId && !r.allowed
    );
    if (channelDeny) {
      return { allowed: false, reason: 'This command cannot be used in this channel.' };
    }

    const channelAllow = rules.find(r =>
      r.targetType === 'channel' && r.targetId === channelId && r.allowed
    );
    if (channelAllow) {
      return { allowed: true };
    }

    // ADDITIVE MODEL: Custom rules work alongside defaults.
    // If no deny rules matched the user, fall back to default Discord permissions.
    // Adding a specific allow or deny rule for one target should NOT affect other users.
    if (defaultPermissions) {
      const memberPerms = member.permissions;
      if (memberPerms.has(PermissionFlagsBits.Administrator)) {
        return { allowed: true };
      }
      const hasPerms = memberPerms.has(defaultPermissions);
      if (!hasPerms) {
        const required = new PermissionsBitField(defaultPermissions);
        const missing = required.toArray().filter(p => !memberPerms.has(PermissionFlagsBits[p as keyof typeof PermissionFlagsBits]));
        return {
          allowed: false,
          reason: `You need the following permission(s): ${missing.join(', ')}`,
        };
      }
    }

    // Default: allow
    return { allowed: true };
  }

  /**
   * Get permission rules for a command in a guild, with Redis caching.
   */
  private async getPermissionRules(guildId: string, commandPath: string): Promise<PermissionRule[]> {
    const redis = getRedis();
    const cacheKey = `perms:${guildId}:${commandPath}`;

    // Try cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Redis failure, fall through to DB
    }

    // Query DB
    const db = getDb();
    const rows = await db.select()
      .from(commandPermissions)
      .where(
        and(
          eq(commandPermissions.guildId, guildId),
          eq(commandPermissions.command, commandPath)
        )
      );

    const rules: PermissionRule[] = rows.map(row => ({
      targetType: row.targetType as 'role' | 'user' | 'channel',
      targetId: row.targetId,
      allowed: row.allowed,
    }));

    // Cache
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(rules));
    } catch {
      // Ignore cache write failures
    }

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

    // Invalidate cache
    const redis = getRedis();
    try {
      await redis.del(`perms:${guildId}:${commandPath}`);
    } catch {
      // Ignore
    }

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

    // Invalidate cache
    const redis = getRedis();
    try {
      await redis.del(`perms:${guildId}:${commandPath}`);
    } catch {
      // Ignore
    }
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
   */
  async clearGuildCache(guildId: string): Promise<void> {
    const redis = getRedis();
    try {
      const keys = await redis.keys(`perms:${guildId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      // Ignore
    }
  }
}

export const permissionManager = new PermissionManager();
export default permissionManager;
