import {
  Guild,
  GuildMember,
  Role,
  TextDisplayBuilder,
} from 'discord.js';
import { getDb } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { timers } from '../../Shared/src/cache/timerManager';
import { eq, and, sql } from 'drizzle-orm';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { moduleContainer, addText, addField, addSeparator, addFooter, v2Payload } from '../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('AutoRoles');

// ============================================
// AutoRoles Module Config Interface
// ============================================

export interface AutoRolesConfig {
  /** Whether to restore roles when a member rejoins */
  persistentRoles: boolean;
  /** Ignore bot accounts for auto-roles */
  ignoreBots: boolean;
  /** Log channel for auto-role assignments */
  logChannelId: string | null;
  /** Whether to stack roles (assign all matching) or stop at first match */
  stackRoles: boolean;
  /** Maximum delay in seconds for delayed roles */
  maxDelay: number;
}

/**
 * Get the auto-roles config for a guild.
 */
export async function getAutoRolesConfig(guildId: string): Promise<AutoRolesConfig> {
  const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'autoroles');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
  return {
    persistentRoles: config?.persistentRoles ?? false,
    ignoreBots: config?.ignoreBots ?? true,
    logChannelId: config?.logChannelId ?? null,
    stackRoles: config?.stackRoles ?? true,
    maxDelay: config?.maxDelay ?? 86400, // 24 hours
  };
}

// ============================================
// Auto-Role Rule Types
// ============================================

export type AutoRoleCondition =
  | 'none'              // Always assign
  | 'human'             // Only humans (not bots)
  | 'bot'               // Only bots
  | 'has_avatar'        // Member has a custom avatar
  | 'account_age_1d'    // Account older than 1 day
  | 'account_age_7d'    // Account older than 7 days
  | 'account_age_30d'   // Account older than 30 days
  | 'account_age_90d'   // Account older than 90 days
  | 'boost'             // Member is boosting the server
  | 'invite_code';      // Joined via specific invite code

export interface AutoRoleRule {
  id: number;
  guildId: string;
  roleId: string;
  condition: AutoRoleCondition;
  conditionValue: string | null; // e.g. invite code
  delaySeconds: number;          // 0 = immediate
  createdBy: string;
  createdAt: number;
  enabled: boolean;
}

export const CONDITION_LABELS: Record<AutoRoleCondition, string> = {
  none: 'Always (no condition)',
  human: 'Humans only (not bots)',
  bot: 'Bots only',
  has_avatar: 'Has custom avatar',
  account_age_1d: 'Account age > 1 day',
  account_age_7d: 'Account age > 7 days',
  account_age_30d: 'Account age > 30 days',
  account_age_90d: 'Account age > 90 days',
  boost: 'Server booster',
  invite_code: 'Joined via specific invite',
};

// ============================================
// Rule CRUD
// ============================================

/**
 * Add a new auto-role rule.
 */
export async function addAutoRoleRule(
  guildId: string,
  roleId: string,
  condition: AutoRoleCondition,
  conditionValue: string | null,
  delaySeconds: number,
  createdBy: string,
): Promise<AutoRoleRule> {
  const db = getDb();

  const result = await db.execute(sql`
    INSERT INTO autorole_rules (guild_id, role_id, condition, condition_value, delay_seconds, created_by, created_at, enabled)
    VALUES (${guildId}, ${roleId}, ${condition}, ${conditionValue}, ${delaySeconds}, ${createdBy}, ${Date.now()}, true)
    RETURNING id, guild_id, role_id, condition, condition_value, delay_seconds, created_by, created_at, enabled
  `);

  const row = (result as any).rows[0];
  cache.del(`autoroles:rules:${guildId}`);

  logger.info('Auto-role rule added', { guildId, roleId, condition });
  eventBus.emit('autoRoleRuleCreated', { guildId, ruleId: row.id.toString(), type: condition, roleId });

  return mapRowToRule(row);
}

/**
 * Delete an auto-role rule by ID.
 */
export async function deleteAutoRoleRule(guildId: string, ruleId: number): Promise<boolean> {
  const db = getDb();

  const result = await db.execute(sql`
    DELETE FROM autorole_rules WHERE id = ${ruleId} AND guild_id = ${guildId}
  `);

  cache.del(`autoroles:rules:${guildId}`);
  return (result as any).rowCount > 0;
}

/**
 * Update an auto-role rule.
 */
export async function updateAutoRoleRule(
  guildId: string,
  ruleId: number,
  updates: Partial<Pick<AutoRoleRule, 'roleId' | 'condition' | 'conditionValue' | 'delaySeconds' | 'enabled'>>,
): Promise<boolean> {
  const db = getDb();

  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.roleId !== undefined) { setClauses.push('role_id = $1'); values.push(updates.roleId); }
  if (updates.condition !== undefined) { setClauses.push('condition = $' + (values.length + 1)); values.push(updates.condition); }
  if (updates.conditionValue !== undefined) { setClauses.push('condition_value = $' + (values.length + 1)); values.push(updates.conditionValue); }
  if (updates.delaySeconds !== undefined) { setClauses.push('delay_seconds = $' + (values.length + 1)); values.push(updates.delaySeconds); }
  if (updates.enabled !== undefined) { setClauses.push('enabled = $' + (values.length + 1)); values.push(updates.enabled); }

  if (setClauses.length === 0) return false;

  // Use raw SQL with template literals for Drizzle
  const result = await db.execute(sql`
    UPDATE autorole_rules
    SET role_id = COALESCE(${updates.roleId ?? null}, role_id),
        condition = COALESCE(${updates.condition ?? null}, condition),
        condition_value = COALESCE(${updates.conditionValue ?? null}, condition_value),
        delay_seconds = COALESCE(${updates.delaySeconds ?? null}, delay_seconds),
        enabled = COALESCE(${updates.enabled ?? null}, enabled)
    WHERE id = ${ruleId} AND guild_id = ${guildId}
  `);

  cache.del(`autoroles:rules:${guildId}`);
  return (result as any).rowCount > 0;
}

/**
 * Get all auto-role rules for a guild.
 */
export async function getAutoRoleRules(guildId: string): Promise<AutoRoleRule[]> {
  const cacheKey = `autoroles:rules:${guildId}`;
  const cached = cache.get<AutoRoleRule[]>(cacheKey);
  if (cached) return cached;

  const db = getDb();
  const result = await db.execute(sql`
    SELECT id, guild_id, role_id, condition, condition_value, delay_seconds, created_by, created_at, enabled
    FROM autorole_rules
    WHERE guild_id = ${guildId}
    ORDER BY created_at ASC
  `);

  const rules = ((result as any).rows || []).map(mapRowToRule);
  cache.set(cacheKey, rules, 300);
  return rules;
}

/**
 * Get a single auto-role rule by ID.
 */
export async function getAutoRoleRule(guildId: string, ruleId: number): Promise<AutoRoleRule | null> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT id, guild_id, role_id, condition, condition_value, delay_seconds, created_by, created_at, enabled
    FROM autorole_rules
    WHERE id = ${ruleId} AND guild_id = ${guildId}
    LIMIT 1
  `);

  const row = (result as any).rows?.[0];
  return row ? mapRowToRule(row) : null;
}

/**
 * Clear all auto-role rules for a guild.
 */
export async function clearAutoRoleRules(guildId: string): Promise<number> {
  const db = getDb();

  const result = await db.execute(sql`
    DELETE FROM autorole_rules WHERE guild_id = ${guildId}
  `);

  cache.del(`autoroles:rules:${guildId}`);
  return (result as any).rowCount || 0;
}

function mapRowToRule(row: any): AutoRoleRule {
  return {
    id: row.id,
    guildId: row.guildId,
    roleId: row.role_id,
    condition: row.condition as AutoRoleCondition,
    conditionValue: row.condition_value,
    delaySeconds: row.delay_seconds,
    createdBy: row.created_by,
    createdAt: row.createdAt,
    enabled: row.enabled,
  };
}

// ============================================
// Condition Evaluation
// ============================================

/**
 * Check whether a member meets a rule's condition.
 */
export function evaluateCondition(
  member: GuildMember,
  rule: AutoRoleRule,
  inviteCode?: string,
): boolean {
  const condition = rule.condition;

  switch (condition) {
    case 'none':
      return true;

    case 'human':
      return !member.user.bot;

    case 'bot':
      return member.user.bot;

    case 'has_avatar':
      return member.user.avatar !== null;

    case 'account_age_1d':
      return Date.now() - member.user.createdTimestamp > 1 * 24 * 60 * 60 * 1000;

    case 'account_age_7d':
      return Date.now() - member.user.createdTimestamp > 7 * 24 * 60 * 60 * 1000;

    case 'account_age_30d':
      return Date.now() - member.user.createdTimestamp > 30 * 24 * 60 * 60 * 1000;

    case 'account_age_90d':
      return Date.now() - member.user.createdTimestamp > 90 * 24 * 60 * 60 * 1000;

    case 'boost':
      return member.premiumSince !== null;

    case 'invite_code':
      return inviteCode === rule.conditionValue;

    default:
      return false;
  }
}

// ============================================
// Delayed Role Assignment
// ============================================

/**
 * Queue a delayed role assignment using TimerManager.
 * The `guild` parameter is stored as a reference for the callback.
 */
export async function queueDelayedRole(
  guildId: string,
  memberId: string,
  roleId: string,
  delaySeconds: number,
  ruleId: number,
): Promise<void> {
  const executeAt = new Date(Date.now() + delaySeconds * 1000);
  const timerId = `autorole:${guildId}:${memberId}:${roleId}`;

  timers.schedule(timerId, executeAt, async () => {
    try {
      // Dynamically import to avoid circular deps — we need a live client reference
      const { getDb: getDbLive } = await import('../../Shared/src/database/connection');

      // We can't hold a Guild reference across restarts, so we use a lazy approach:
      // The guild object must be fetched fresh. But since we don't have a client ref here,
      // we rely on the timer only running while the bot is alive (in-memory timers reset on restart).
      // Delayed roles are short-lived (max 24h) and non-critical — acceptable to lose on restart.
      logger.debug('Delayed role timer fired', { guildId, memberId, roleId });
    } catch (err: any) {
      logger.error('Failed to process delayed role timer', { error: err.message });
    }
  });

  logger.debug('Queued delayed role', { guildId, memberId, roleId, delaySeconds });
}

/**
 * Queue a delayed role assignment with a live guild reference (called from events).
 */
export function queueDelayedRoleWithGuild(
  guild: Guild,
  memberId: string,
  roleId: string,
  delaySeconds: number,
  ruleId: number,
): void {
  const executeAt = new Date(Date.now() + delaySeconds * 1000);
  const timerId = `autorole:${guild.id}:${memberId}:${roleId}`;

  timers.schedule(timerId, executeAt, async () => {
    try {
      const member = await guild.members.fetch(memberId).catch(() => null);
      if (!member) return;

      const role = guild.roles.cache.get(roleId);
      if (!role) return;

      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(role, 'Auto-role (delayed)');
        await logAutoRole(guild, member, role.name, 'Delayed auto-role');
        logger.debug('Delayed role assigned', { guild: guild.id, member: memberId, role: role.name });
      }
    } catch (err: any) {
      logger.error('Failed to process delayed role', { error: err.message });
    }
  });

  logger.debug('Queued delayed role', { guildId: guild.id, memberId, roleId, delaySeconds });
}

// ============================================
// Persistent Roles (save/restore on rejoin)
// ============================================

/**
 * Save a member's current roles for later restoration.
 */
export async function saveMemberRoles(guildId: string, memberId: string, roleIds: string[]): Promise<void> {
  const db = getDb();

  // Only save non-@everyone roles
  const filtered = roleIds.filter(id => id !== guildId);
  if (filtered.length === 0) return;

  await db.execute(sql`
    INSERT INTO autorole_persistent (guild_id, member_id, role_ids, saved_at)
    VALUES (${guildId}, ${memberId}, ${JSON.stringify(filtered)}, ${Date.now()})
    ON CONFLICT (guild_id, member_id)
    DO UPDATE SET role_ids = ${JSON.stringify(filtered)}, saved_at = ${Date.now()}
  `);
}

/**
 * Restore a member's saved roles on rejoin.
 */
export async function restoreMemberRoles(member: GuildMember): Promise<string[]> {
  const db = getDb();
  const guildId = member.guild.id;

  const result = await db.execute(sql`
    SELECT role_ids FROM autorole_persistent
    WHERE guild_id = ${guildId} AND member_id = ${member.id}
    LIMIT 1
  `);

  const row = (result as any).rows?.[0];
  if (!row) return [];

  let roleIds: string[];
  try {
    roleIds = JSON.parse(row.role_ids);
  } catch {
    return [];
  }

  const restored: string[] = [];

  for (const roleId of roleIds) {
    const role = member.guild.roles.cache.get(roleId);
    if (!role) continue;
    if (member.roles.cache.has(roleId)) continue;

    try {
      await member.roles.add(role, 'Persistent role restore');
      restored.push(role.name);
    } catch (err: any) {
      logger.debug('Could not restore role', { role: role.name, error: err.message });
    }
  }

  // Clean up saved data after restore
  await db.execute(sql`
    DELETE FROM autorole_persistent WHERE guild_id = ${guildId} AND member_id = ${member.id}
  `);

  return restored;
}

// ============================================
// Logging
// ============================================

/**
 * Log an auto-role assignment event.
 */
export async function logAutoRole(
  guild: Guild,
  member: GuildMember,
  roleName: string,
  reason: string,
): Promise<void> {
  const config = await getAutoRolesConfig(guild.id);
  if (!config.logChannelId) return;

  try {
    const channel = await guild.channels.fetch(config.logChannelId).catch(() => null);
    if (!channel || !('send' in channel)) return;

    const container = moduleContainer('auto_roles');
    addText(container, '### 🏷️ Auto-Role Assigned');
    addSeparator(container, 'small');
    addField(container, 'Member', `${member} (${member.user.tag})`, true);
    addField(container, 'Role', roleName, true);
    addField(container, 'Reason', reason, false);

    await (channel as any).send(v2Payload([container]));
  } catch (err: any) {
    logger.debug('Failed to log auto-role', { error: err.message });
  }
}
