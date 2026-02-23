import { getDb } from '../../Shared/src/database/connection';
import { getRedis } from '../../Shared/src/database/connection';
import { guildMembers } from '../../Shared/src/database/models/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { eventBus } from '../../Shared/src/events/eventBus';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { EmbedBuilder, GuildMember, AttachmentBuilder } from 'discord.js';
import { Colors } from '../../Shared/src/utils/embed';

const logger = createModuleLogger('Leveling');

// ============================================
// Leveling Config Interface
// ============================================

export interface LevelingConfig {
  // XP settings
  xpPerMessage: { min: number; max: number }; // random between min-max
  xpCooldownSeconds: number;
  xpPerVoiceMinute: number;
  voiceRequireUnmuted: boolean; // must be unmuted to earn voice XP

  // Channels
  xpEnabledChannels: string[]; // empty = all channels
  xpDisabledChannels: string[]; // these channels give no XP

  // Multipliers per role: { roleId: multiplier }
  roleMultipliers: Record<string, number>;

  // No-XP roles (these earn nothing)
  noXpRoles: string[];

  // Announcements
  announceType: 'current' | 'channel' | 'dm' | 'off';
  announceChannelId?: string;
  announceMessage: string; // supports {user}, {level}, {role}

  // Level roles: { level: { roleId, stack } }
  levelRoles: Array<{ level: number; roleId: string }>;
  stackRoles: boolean; // true = keep all level roles, false = only highest

  // Double XP
  doubleXpActive: boolean;
  doubleXpExpiresAt?: string; // ISO timestamp

  // Prestige
  prestigeEnabled: boolean;
  prestigeMaxLevel: number; // level needed to prestige
  prestigeXpMultiplier: number; // permanent multiplier per prestige (e.g., 0.05 = +5%)

  // Card styles
  defaultCardStyle: string;
}

export const DEFAULT_LEVELING_CONFIG: LevelingConfig = {
  xpPerMessage: { min: 15, max: 25 },
  xpCooldownSeconds: 60,
  xpPerVoiceMinute: 5,
  voiceRequireUnmuted: true,
  xpEnabledChannels: [],
  xpDisabledChannels: [],
  roleMultipliers: {},
  noXpRoles: [],
  announceType: 'current',
  announceChannelId: undefined,
  announceMessage: 'Congratulations {user}! You\'ve reached **Level {level}**! 🎉',
  levelRoles: [],
  stackRoles: true,
  doubleXpActive: false,
  doubleXpExpiresAt: undefined,
  prestigeEnabled: false,
  prestigeMaxLevel: 100,
  prestigeXpMultiplier: 0.05,
  defaultCardStyle: 'default',
};

// ============================================
// Get Config
// ============================================

export async function getLevelingConfig(guildId: string): Promise<LevelingConfig> {
  const cfg = await moduleConfig.getModuleConfig<LevelingConfig>(guildId, 'leveling');
  return { ...DEFAULT_LEVELING_CONFIG, ...(cfg?.config || {}) };
}

// ============================================
// XP / Level Calculations
// ============================================

/**
 * Calculate XP needed to reach a specific level.
 * Formula: 5 * (level^2) + 50 * level + 100
 */
export function xpForLevel(level: number): number {
  return 5 * (level * level) + 50 * level + 100;
}

/**
 * Calculate total XP needed from level 0 to target level.
 */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

/**
 * Calculate level from total XP.
 */
export function levelFromTotalXp(totalXp: number): { level: number; currentXp: number; xpNeeded: number } {
  let level = 0;
  let remaining = totalXp;

  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }

  return {
    level,
    currentXp: remaining,
    xpNeeded: xpForLevel(level),
  };
}

/**
 * Generate random XP within configured range.
 */
export function randomXp(config: LevelingConfig): number {
  const { min, max } = config.xpPerMessage;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate effective XP multiplier for a member.
 */
export function getXpMultiplier(
  member: GuildMember,
  config: LevelingConfig,
  prestige: number = 0
): number {
  let multiplier = 1.0;

  // Role multipliers (use highest)
  let highestRoleMultiplier = 1.0;
  for (const [roleId, mult] of Object.entries(config.roleMultipliers)) {
    if (member.roles.cache.has(roleId) && mult > highestRoleMultiplier) {
      highestRoleMultiplier = mult;
    }
  }
  multiplier *= highestRoleMultiplier;

  // Double XP
  if (config.doubleXpActive) {
    if (config.doubleXpExpiresAt) {
      const expires = new Date(config.doubleXpExpiresAt);
      if (expires > new Date()) {
        multiplier *= 2;
      }
    } else {
      multiplier *= 2;
    }
  }

  // Prestige bonus
  if (prestige > 0 && config.prestigeEnabled) {
    multiplier *= (1 + prestige * config.prestigeXpMultiplier);
  }

  return multiplier;
}

/**
 * Check if a member should earn XP (not in no-XP role, channel is allowed).
 */
export function shouldEarnXp(
  memberRoles: string[],
  channelId: string,
  config: LevelingConfig
): boolean {
  // Check no-XP roles
  for (const roleId of config.noXpRoles) {
    if (memberRoles.includes(roleId)) return false;
  }

  // Check channel restrictions
  if (config.xpDisabledChannels.includes(channelId)) return false;
  if (config.xpEnabledChannels.length > 0 && !config.xpEnabledChannels.includes(channelId)) return false;

  return true;
}

// ============================================
// Grant XP & Handle Level-ups
// ============================================

export async function grantXp(
  guildId: string,
  userId: string,
  amount: number,
  source: string
): Promise<{ leveledUp: boolean; oldLevel: number; newLevel: number; totalXp: number } | null> {
  const db = getDb();

  // Ensure member exists
  await db.execute(sql`
    INSERT INTO users (id, created_at, updated_at) VALUES (${userId}, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO guild_members (guild_id, user_id) VALUES (${guildId}, ${userId})
    ON CONFLICT (guild_id, user_id) DO NOTHING
  `);

  // Get current state
  const [member] = await db.select({
    xp: guildMembers.xp,
    level: guildMembers.level,
    totalXp: guildMembers.totalXp,
    prestige: guildMembers.prestige,
  })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
    .limit(1);

  if (!member) return null;

  const oldLevel = member.level;
  let currentXp = member.xp + amount;
  let level = member.level;
  const newTotalXp = Number(member.totalXp) + amount;

  // Check for level-up(s)
  let leveledUp = false;
  while (currentXp >= xpForLevel(level)) {
    currentXp -= xpForLevel(level);
    level++;
    leveledUp = true;
  }

  // Update DB
  await db.update(guildMembers)
    .set({
      xp: currentXp,
      level,
      totalXp: newTotalXp,
    })
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)));

  // Emit events
  if (leveledUp) {
    eventBus.emit('levelUp', { guildId, userId, oldLevel, newLevel: level });
    eventBus.emit('xpGain', { guildId, userId, amount, source });
  }

  return { leveledUp, oldLevel, newLevel: level, totalXp: newTotalXp };
}

// ============================================
// Level Role Management
// ============================================

export async function assignLevelRoles(
  member: GuildMember,
  newLevel: number,
  config: LevelingConfig
): Promise<string[]> {
  const assignedRoles: string[] = [];
  const sortedRoles = [...config.levelRoles].sort((a, b) => a.level - b.level);

  for (const lr of sortedRoles) {
    if (newLevel >= lr.level) {
      if (!member.roles.cache.has(lr.roleId)) {
        try {
          await member.roles.add(lr.roleId, `Level ${lr.level} reward`);
          assignedRoles.push(lr.roleId);
        } catch (err: any) {
          logger.error('Failed to assign level role', { error: err.message, roleId: lr.roleId });
        }
      }
    }
  }

  // If not stacking, remove lower level roles
  if (!config.stackRoles && assignedRoles.length > 0) {
    const highestEarned = sortedRoles.filter(lr => newLevel >= lr.level).pop();
    for (const lr of sortedRoles) {
      if (lr.roleId !== highestEarned?.roleId && member.roles.cache.has(lr.roleId)) {
        try {
          await member.roles.remove(lr.roleId, 'Non-stacking level role replacement');
        } catch {
          // Ignore
        }
      }
    }
  }

  return assignedRoles;
}

// ============================================
// Rank Position
// ============================================

export async function getRankPosition(guildId: string, userId: string): Promise<number> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT COUNT(*) + 1 as rank FROM guild_members
    WHERE guild_id = ${guildId}
    AND total_xp > (
      SELECT total_xp FROM guild_members
      WHERE guild_id = ${guildId} AND user_id = ${userId}
    )
  `);

  return ((result as any)[0] as any)?.rank || 0;
}

// ============================================
// Progress Bar Helper
// ============================================

export function progressBar(current: number, total: number, length: number = 20): string {
  const percentage = Math.min(current / total, 1);
  const filled = Math.round(percentage * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// ============================================
// Rank Card Embed (text-based fallback)
// ============================================

export function rankEmbed(params: {
  username: string;
  avatarUrl: string;
  level: number;
  currentXp: number;
  xpNeeded: number;
  totalXp: number;
  rank: number;
  prestige: number;
  streak?: number;
  style?: string;
}): EmbedBuilder {
  const { username, avatarUrl, level, currentXp, xpNeeded, totalXp, rank, prestige } = params;
  const percentage = Math.round((currentXp / xpNeeded) * 100);
  const bar = progressBar(currentXp, xpNeeded, 20);

  const embed = new EmbedBuilder()
    .setColor(Colors.Leveling)
    .setTitle(`${prestige > 0 ? `✨P${prestige} ` : ''}${username}`)
    .setThumbnail(avatarUrl)
    .addFields(
      { name: 'Rank', value: `#${rank}`, inline: true },
      { name: 'Level', value: `${level}`, inline: true },
      { name: 'Total XP', value: totalXp.toLocaleString(), inline: true },
      {
        name: `Progress — ${percentage}%`,
        value: `${bar}\n${currentXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`,
      },
    )
    .setTimestamp();

  if (prestige > 0) {
    embed.setFooter({ text: `Prestige ${prestige} • +${prestige * 5}% XP bonus` });
  }

  return embed;
}
