import {
  GuildMember,
  User,
  EmbedBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Guild,
} from 'discord.js';
import { getDb } from '../../Shared/src/database/connection';
import { modCases, guildMembers, guilds, users } from '../../Shared/src/database/models/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { Colors } from '../../Shared/src/utils/embed';
import { t } from '../../Shared/src/i18n';
import { createModuleLogger } from '../../Shared/src/utils/logger';

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

  // Warning thresholds: [{ count, action, duration? }]
  warnThresholds: Array<{
    count: number;
    action: 'mute' | 'kick' | 'ban';
    duration?: number; // seconds, for mute
  }>;

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
  appealEnabled: false,
  fineEnabled: false,
  fineAmounts: { warn: 0, mute: 0, kick: 0, ban: 0 },
  reputationEnabled: true,
  defaultReputation: 100,
  reputationPenalties: { warn: 5, mute: 10, kick: 15, ban: 25 },
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
  action: 'warn' | 'mute' | 'unmute' | 'kick' | 'ban' | 'unban' | 'tempban' | 'softban' | 'note';
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
    const embed = new EmbedBuilder()
      .setColor(Colors.Moderation)
      .setTitle(`Moderation Action — ${params.guild.name}`)
      .addFields(
        { name: 'Action', value: params.action, inline: true },
        { name: 'Case', value: `#${params.caseNumber}`, inline: true },
        { name: 'Reason', value: params.reason },
      )
      .setTimestamp();

    if (params.duration) {
      embed.addFields({ name: 'Duration', value: params.duration, inline: true });
    }

    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    if (params.appealEnabled) {
      const appealButton = new ButtonBuilder()
        .setCustomId(`moderation:appeal:${params.guild.id}:${params.caseNumber}`)
        .setLabel('Appeal')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📝');

      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(appealButton)
      );
    }

    await params.user.send({
      embeds: [embed],
      components,
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

  return null;
}

// ============================================
// Warning Threshold Check
// ============================================

/**
 * Check if a user has hit a warning threshold and auto-escalate.
 */
export async function checkWarnThresholds(
  guildId: string,
  userId: string,
  warnCount: number,
  config: ModerationConfig,
  guild: Guild
): Promise<void> {
  if (!config.warnThresholds || config.warnThresholds.length === 0) return;

  // Sort thresholds descending so we match the highest first
  const sorted = [...config.warnThresholds].sort((a, b) => b.count - a.count);

  for (const threshold of sorted) {
    if (warnCount >= threshold.count) {
      eventBus.emit('warnThresholdReached', {
        guildId,
        userId,
        warnCount,
        threshold: threshold.count,
        action: threshold.action,
      });

      logger.info('Warning threshold reached', {
        guildId,
        userId,
        warnCount,
        threshold: threshold.count,
        action: threshold.action,
      });

      break; // Only trigger the highest matching threshold
    }
  }
}

// ============================================
// Reputation Helpers
// ============================================

/**
 * Adjust a user's moderation reputation score.
 */
export async function adjustReputation(
  guildId: string,
  userId: string,
  amount: number
): Promise<number> {
  const db = getDb();

  // Ensure guild member exists
  await ensureGuildMember(guildId, userId);

  // Update reputation (clamp to 0-200 range)
  await db.execute(sql`
    UPDATE guild_members
    SET reputation = GREATEST(0, LEAST(200, reputation + ${amount}))
    WHERE guild_id = ${guildId} AND user_id = ${userId}
  `);

  // Get new value
  const [member] = await db.select({ reputation: guildMembers.reputation })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
    .limit(1);

  return member?.reputation ?? 100;
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
// Mod Action Embed Builder
// ============================================

/**
 * Build a standard mod action response embed.
 */
export function modActionEmbed(params: {
  action: string;
  target: User;
  moderator: User;
  reason: string;
  caseNumber: number;
  duration?: string;
  dmSent?: boolean;
  extraFields?: Array<{ name: string; value: string; inline?: boolean }>;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(Colors.Moderation)
    .setTitle(`${params.action} — Case #${params.caseNumber}`)
    .addFields(
      { name: 'User', value: `${params.target.tag} (${params.target.id})`, inline: true },
      { name: 'Moderator', value: `${params.moderator.tag}`, inline: true },
      { name: 'Reason', value: params.reason },
    )
    .setThumbnail(params.target.displayAvatarURL())
    .setTimestamp();

  if (params.duration) {
    embed.addFields({ name: 'Duration', value: params.duration, inline: true });
  }

  if (params.dmSent !== undefined) {
    embed.setFooter({ text: params.dmSent ? 'DM sent to user' : 'Could not DM user' });
  }

  if (params.extraFields) {
    embed.addFields(...params.extraFields);
  }

  return embed;
}

/**
 * Get the moderation config for a guild.
 */
export async function getModConfig(guildId: string): Promise<ModerationConfig> {
  const cfg = await moduleConfig.getModuleConfig<ModerationConfig>(guildId, 'moderation');
  return { ...DEFAULT_MOD_CONFIG, ...(cfg?.config || {}) };
}
