import {
  GuildMember,
  User,
  ContainerBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  Guild,
  PermissionFlagsBits,
} from 'discord.js';
import { getDb } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { modCases, guildMembers, guilds, users } from '../../Shared/src/database/models/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import {
  modActionContainer,
  addTitleSection,
  addFields as addFieldsV2,
} from '../../Shared/src/utils/componentsV2';
import { t } from '../../Shared/src/i18n';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { removeCurrency } from '../Currency/helpers';

const logger = createModuleLogger('Moderation');

// ============================================
// Moderation Module Config Interface
// ============================================

export interface ModerationConfig {
  // DM notifications
  dmOnBan: boolean;
  dmOnKick: boolean;
  dmOnMute: boolean;
  dmOnWarn: boolean;

  // Require reasons
  requireReason: boolean;

  // Warning thresholds (flat fields for easy UI config)
  warnThresholds: Array<{
    count: number;
    action: 'mute' | 'kick' | 'ban';
    duration?: number; // seconds, for mute
  }>;
  warnAutoMuteEnabled: boolean;
  warnAutoMuteCount: number;
  warnAutoMuteDuration: number; // seconds (default 3600 = 1h)
  warnAutoKickEnabled: boolean;
  warnAutoKickCount: number;
  warnAutoBanEnabled: boolean;
  warnAutoBanCount: number;

  // Appeal system
  appealEnabled: boolean;
  appealChannelId?: string;

  // Currency fines
  fineEnabled: boolean;
  fineAmounts: {
    warn: number;
    mute: number;
    kick: number;
    ban: number;
  };

  // Reputation
  reputationEnabled: boolean;
  defaultReputation: number;
  reputationPenalties: {
    warn: number;
    mute: number;
    kick: number;
    tempban: number;
    ban: number;
  };

  // Shadow ban
  shadowBanEnabled: boolean;

  // Quarantine
  quarantineRoleId?: string;

  // Alt detection
  altDetectionEnabled: boolean;
  altDetectionLogChannelId?: string;
  altDetectionKeywords: string[];

  // Watchlist
  watchlistChannelId?: string;
  watchlistMessageId?: string;
}

export const DEFAULT_MOD_CONFIG: ModerationConfig = {
  dmOnBan: true,
  dmOnKick: true,
  dmOnMute: true,
  dmOnWarn: true,
  requireReason: false,
  warnThresholds: [],
  warnAutoMuteEnabled: false,
  warnAutoMuteCount: 3,
  warnAutoMuteDuration: 3600,
  warnAutoKickEnabled: false,
  warnAutoKickCount: 10,
  warnAutoBanEnabled: false,
  warnAutoBanCount: 20,
  appealEnabled: false,
  fineEnabled: false,
  fineAmounts: { warn: 0, mute: 0, kick: 0, ban: 0 },
  reputationEnabled: true,
  defaultReputation: 80,
  reputationPenalties: { warn: 1, mute: 5, kick: 10, tempban: 15, ban: 20 },
  shadowBanEnabled: true,
  altDetectionEnabled: false,
  altDetectionLogChannelId: undefined,
  altDetectionKeywords: ['my alt', 'this is my alt', 'my other account', 'alt account', 'second account'],
  watchlistChannelId: undefined,
  watchlistMessageId: undefined,
};

// ============================================
// Case Management
// ============================================

/**
 * Get the next case number for a guild.
 */
export async function getNextCaseNumber(guildId: string): Promise<number> {
  const db = getDb();
  const [result] = await db.select({
    maxCase: sql<number>`COALESCE(MAX(case_number), 0)`,
  })
    .from(modCases)
    .where(eq(modCases.guildId, guildId));

  return (result?.maxCase || 0) + 1;
}

/**
 * Create a moderation case.
 */
export async function createModCase(params: {
  guildId: string;
  action: 'warn' | 'mute' | 'unmute' | 'kick' | 'ban' | 'unban' | 'tempban' | 'softban' | 'note' | 'lock' | 'unlock' | 'deafen' | 'undeafen' | 'quarantine' | 'unquarantine' | 'shadowban' | 'unshadowban' | 'autokick' | 'unautokick';
  targetId: string;
  moderatorId: string;
  reason?: string;
  duration?: number; // seconds
}): Promise<number> {
  const db = getDb();
  const caseNumber = await getNextCaseNumber(params.guildId);

  const expiresAt = params.duration
    ? new Date(Date.now() + params.duration * 1000)
    : undefined;

  await db.insert(modCases).values({
    guildId: params.guildId,
    caseNumber,
    action: params.action,
    targetId: params.targetId,
    moderatorId: params.moderatorId,
    reason: params.reason || 'No reason provided',
    duration: params.duration,
    expiresAt,
  });

  // Emit event for logging module
  eventBus.emit('modAction', {
    guildId: params.guildId,
    action: params.action,
    targetId: params.targetId,
    moderatorId: params.moderatorId,
    reason: params.reason,
    caseNumber,
  });

  return caseNumber;
}

// ============================================
// DM Notifications
// ============================================

/**
 * Send a DM to a user about a mod action.
 */
export async function sendModDM(params: {
  user: User;
  guild: Guild;
  action: string;
  reason: string;
  caseNumber: number;
  duration?: string;
  appealEnabled?: boolean;
}): Promise<boolean> {
  try {
    const container = new ContainerBuilder().setAccentColor(0xE74C3C); // Moderation color

    // Add title and basic fields
    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Action', value: params.action, inline: true },
      { name: 'Case', value: `#${params.caseNumber}`, inline: true },
      { name: 'Reason', value: params.reason },
    ];

    if (params.duration) {
      fields.push({ name: 'Duration', value: params.duration, inline: true });
    }

    addTitleSection(container, `Moderation Action — ${params.guild.name}`);
    addFieldsV2(container, fields);

    // Add appeal button if enabled
    if (params.appealEnabled) {
      const appealButton = new ButtonBuilder()
        .setCustomId(`moderation:appeal:${params.guild.id}:${params.caseNumber}`)
        .setLabel('Appeal')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📝');

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(appealButton);
      container.addActionRowComponents(row);
    }

    await params.user.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    return true;
  } catch {
    // User has DMs disabled
    return false;
  }
}

// ============================================
// Permission Hierarchy Checks
// ============================================

/**
 * Check if the executor can take action on the target.
 * Returns an error message if they can't, null if they can.
 */
export function canModerate(
  executor: GuildMember,
  target: GuildMember,
  action: string
): string | null {
  // Can't target yourself
  if (executor.id === target.id) {
    return `You cannot ${action} yourself.`;
  }

  // Can't target the guild owner
  if (target.id === target.guild.ownerId) {
    return `You cannot ${action} the server owner.`;
  }

  // Can't target someone with a higher or equal role
  if (target.roles.highest.position >= executor.roles.highest.position && executor.id !== executor.guild.ownerId) {
    return `You cannot ${action} someone with a higher or equal role.`;
  }

  // Bot can't target someone with a higher role than itself
  const botMember = target.guild.members.me;
  if (botMember && target.roles.highest.position >= botMember.roles.highest.position) {
    return `I cannot ${action} that user — they have a higher role than me.`;
  }

  // Discord API restriction: cannot timeout members with Administrator permission
  if (action === 'mute' && target.permissions.has(PermissionFlagsBits.Administrator)) {
    return `I cannot timeout that user — Discord does not allow timing out members with Administrator permission.`;
  }

  return null;
}

// ============================================
// Warning Threshold Validation
// ============================================

/**
 * Validate warn threshold escalation order.
 * When multiple auto-actions are enabled, thresholds must increase: mute < kick < ban.
 * Returns null if valid, or an error string describing the issue.
 */
export function validateWarnThresholds(config: Partial<ModerationConfig>): string | null {
  const enabled: Array<{ key: string; label: string; count: number }> = [];

  if (config.warnAutoMuteEnabled && config.warnAutoMuteCount && config.warnAutoMuteCount > 0) {
    enabled.push({ key: 'mute', label: 'Auto-Mute', count: config.warnAutoMuteCount });
  }
  if (config.warnAutoKickEnabled && config.warnAutoKickCount && config.warnAutoKickCount > 0) {
    enabled.push({ key: 'kick', label: 'Auto-Kick', count: config.warnAutoKickCount });
  }
  if (config.warnAutoBanEnabled && config.warnAutoBanCount && config.warnAutoBanCount > 0) {
    enabled.push({ key: 'ban', label: 'Auto-Ban', count: config.warnAutoBanCount });
  }

  // Check escalation order: mute < kick < ban
  const muteEntry = enabled.find(e => e.key === 'mute');
  const kickEntry = enabled.find(e => e.key === 'kick');
  const banEntry = enabled.find(e => e.key === 'ban');

  if (muteEntry && kickEntry && muteEntry.count >= kickEntry.count) {
    return `Auto-Mute threshold (${muteEntry.count}) must be lower than Auto-Kick (${kickEntry.count})`;
  }
  if (muteEntry && banEntry && muteEntry.count >= banEntry.count) {
    return `Auto-Mute threshold (${muteEntry.count}) must be lower than Auto-Ban (${banEntry.count})`;
  }
  if (kickEntry && banEntry && kickEntry.count >= banEntry.count) {
    return `Auto-Kick threshold (${kickEntry.count}) must be lower than Auto-Ban (${banEntry.count})`;
  }

  return null;
}

// ============================================
// Warning Threshold Check
// ============================================

/**
 * Result from a threshold check — null if no threshold was hit.
 */
export interface ThresholdResult {
  action: 'mute' | 'kick' | 'ban';
  threshold: number;
  duration?: number; // seconds, for mute
}

/**
 * Check if a user has hit a warning threshold and auto-escalate.
 * Returns the triggered action info so callers can include it in embeds/DMs.
 */
export async function checkWarnThresholds(
  guildId: string,
  userId: string,
  warnCount: number,
  config: ModerationConfig,
  guild: Guild
): Promise<ThresholdResult | null> {
  // Build thresholds from flat config fields
  let thresholds = config.warnThresholds ?? [];

  // Flat fields take priority if any are enabled
  const flatThresholds: typeof thresholds = [];
  if (config.warnAutoMuteEnabled && config.warnAutoMuteCount > 0) {
    flatThresholds.push({ count: config.warnAutoMuteCount, action: 'mute', duration: config.warnAutoMuteDuration || 3600 });
  }
  if (config.warnAutoKickEnabled && config.warnAutoKickCount > 0) {
    flatThresholds.push({ count: config.warnAutoKickCount, action: 'kick' });
  }
  if (config.warnAutoBanEnabled && config.warnAutoBanCount > 0) {
    flatThresholds.push({ count: config.warnAutoBanCount, action: 'ban' });
  }

  if (flatThresholds.length > 0) thresholds = flatThresholds;
  if (thresholds.length === 0) return null;

  // Only fire at exact threshold counts — not on every warn above
  for (const threshold of thresholds) {
    if (warnCount === threshold.count) {
      eventBus.emit('warnThresholdReached', {
        guildId,
        userId,
        warnCount,
        threshold: threshold.count,
        action: threshold.action,
        duration: threshold.duration,
      });

      logger.info('Warning threshold reached', {
        guildId,
        userId,
        warnCount,
        threshold: threshold.count,
        action: threshold.action,
      });

      return {
        action: threshold.action as 'mute' | 'kick' | 'ban',
        threshold: threshold.count,
        duration: threshold.duration,
      };
    }
  }

  return null;
}

// ============================================
// Reputation Helpers
// ============================================

/**
 * Adjust a user's moderation reputation score.
 * Syncs to both guild_members AND reputation_users tables.
 */
export async function adjustReputation(
  guildId: string,
  userId: string,
  amount: number,
  reason?: string,
  moderatorId?: string,
): Promise<number> {
  const db = getDb();

  // Ensure guild member exists
  await ensureGuildMember(guildId, userId);

  // Update reputation (clamp to 0-100 range)
  await db.execute(sql`
    UPDATE guild_members
    SET reputation = GREATEST(0, LEAST(100, reputation + ${amount}))
    WHERE guild_id = ${guildId} AND user_id = ${userId}
  `);

  // Get new value
  const [member] = await db.select({ reputation: guildMembers.reputation })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
    .limit(1);

  const newRep = member?.reputation ?? 80;

  // Sync to reputation_users table so /rep command stays consistent
  try {
    await db.execute(sql`
      INSERT INTO reputation_users (guild_id, user_id, reputation, last_active)
      VALUES (${guildId}, ${userId}, ${newRep}, ${Date.now()})
      ON CONFLICT (guild_id, user_id)
      DO UPDATE SET reputation = ${newRep}, last_active = ${Date.now()}
    `);

    // Log to reputation_history for full audit trail
    if (amount !== 0) {
      await db.execute(sql`
        INSERT INTO reputation_history (guild_id, user_id, given_by, delta, reason, created_at)
        VALUES (${guildId}, ${userId}, ${moderatorId || 'system'}, ${amount}, ${reason || 'Moderation action'}, ${Date.now()})
      `);
    }

    // Invalidate cache for the Reputation module
    cache.del(`rep:${guildId}:${userId}`);
  } catch {
    // Non-fatal — guild_members is the source of truth
  }

  return newRep;
}

// ============================================
// Currency Fine Deduction
// ============================================

/**
 * Deduct a currency fine from a user for a moderation action.
 * Only deducts if fineEnabled is true and the fine amount for the action is > 0.
 * Uses the currency module's removeCurrency if available, falls back to raw SQL.
 *
 * @returns The amount deducted (0 if fines disabled or amount is 0)
 */
export async function deductFine(
  guildId: string,
  userId: string,
  action: 'warn' | 'mute' | 'kick' | 'ban',
  config: ModerationConfig,
): Promise<number> {
  if (!config.fineEnabled) return 0;

  const fineAmount = config.fineAmounts?.[action] ?? 0;
  if (fineAmount <= 0) return 0;

  try {
    const result = await removeCurrency(guildId, userId, 'coins', fineAmount, `Fine: ${action}`, {
      type: 'moderation_fine',
      action,
    });

    if (result.success) {
      logger.debug('Fine deducted', { guildId, userId, action, amount: fineAmount });
      return fineAmount;
    }

    // If insufficient balance, force-deduct to 0 (fines are non-optional)
    const db = getDb();
    await db.execute(sql`
      UPDATE guild_members
      SET coins = GREATEST(0, coins - ${fineAmount})
      WHERE guild_id = ${guildId} AND user_id = ${userId}
    `);
    logger.debug('Fine force-deducted (insufficient balance)', { guildId, userId, action, amount: fineAmount });
    return fineAmount;
  } catch (err: any) {
    logger.warn('Fine deduction failed', { guildId, userId, action, error: err.message });
    return 0;
  }
}

// ============================================
// Ensure Records Exist
// ============================================

/**
 * Ensure a guild exists in the database.
 */
export async function ensureGuild(guild: Guild): Promise<void> {
  const db = getDb();
  await db.insert(guilds).values({
    id: guild.id,
    name: guild.name,
    ownerId: guild.ownerId,
  }).onConflictDoUpdate({
    target: guilds.id,
    set: { name: guild.name, ownerId: guild.ownerId },
  });
}

/**
 * Ensure a guild member exists in the database.
 */
export async function ensureGuildMember(guildId: string, userId: string): Promise<void> {
  const db = getDb();

  // Ensure user exists
  await db.insert(users)
    .values({ id: userId, createdAt: new Date(), updatedAt: new Date() })
    .onConflictDoNothing()
    .execute()
    .catch(() => {
      // Fallback: raw query
      return db.execute(sql`
        INSERT INTO users (id, created_at, updated_at) VALUES (${userId}, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);
    });

  // Ensure guild member exists
  await db.execute(sql`
    INSERT INTO guild_members (guild_id, user_id) VALUES (${guildId}, ${userId})
    ON CONFLICT (guild_id, user_id) DO NOTHING
  `);
}

// ============================================
// Mod Action Container Builder
// ============================================

/**
 * Build a standard mod action response container.
 * Wrapper around the V2 modActionContainer from componentsV2.
 */
export function buildModActionContainer(params: {
  action: string;
  target: User;
  moderator: User;
  reason: string;
  caseNumber: number;
  duration?: string;
  dmSent?: boolean;
  extraFields?: Array<{ name: string; value: string; inline?: boolean }>;
}): ContainerBuilder {
  return modActionContainer({
    action: params.action,
    targetTag: params.target.tag,
    targetId: params.target.id,
    targetAvatarUrl: params.target.displayAvatarURL(),
    moderatorTag: params.moderator.tag,
    reason: params.reason,
    caseNumber: params.caseNumber,
    duration: params.duration,
    dmSent: params.dmSent,
    extraFields: params.extraFields,
  });
}

/**
 * Get the moderation config for a guild.
 */
export async function getModConfig(guildId: string): Promise<ModerationConfig> {
  const cfg = await moduleConfig.getModuleConfig<ModerationConfig>(guildId, 'moderation');
  return { ...DEFAULT_MOD_CONFIG, ...(cfg?.config || {}) };
}
