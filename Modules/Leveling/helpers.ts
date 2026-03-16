import { getDb } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { guildMembers } from '../../Shared/src/database/models/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { eventBus } from '../../Shared/src/events/eventBus';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { ContainerBuilder, GuildMember, AttachmentBuilder } from 'discord.js';
import { moduleContainer, addText, addFields, addSeparator, addFooter, addSectionWithThumbnail, v2Payload } from '../../Shared/src/utils/componentsV2';

// Lazy-load canvas — try @napi-rs/canvas first (prebuilt), fall back to node-canvas
let createCanvas: any;
let loadImage: any;
try {
  const napi = require('@napi-rs/canvas');
  createCanvas = (w: number, h: number) => napi.createCanvas(w, h);
  loadImage = (src: string) => napi.loadImage(src);
} catch {
  try {
    const canvasModule = require('canvas');
    createCanvas = canvasModule.createCanvas;
    loadImage = canvasModule.loadImage;
  } catch {
    // No canvas library available — rank cards will fall back to text embeds
  }
}

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
      SELECT COALESCE(total_xp, 0) FROM guild_members
      WHERE guild_id = ${guildId} AND user_id = ${userId}
    )
  `);

  const row = (result as any).rows?.[0] ?? (result as any)[0];
  return Number(row?.rank) || 1;
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
// Rank Card Container (text-based fallback)
// ============================================

export function rankContainer(params: {
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
}): ContainerBuilder {
  const { username, avatarUrl, level, currentXp, xpNeeded, totalXp, rank, prestige } = params;
  const percentage = Math.round((currentXp / xpNeeded) * 100);
  const bar = progressBar(currentXp, xpNeeded, 20);

  const container = moduleContainer('leveling');

  // Title with avatar thumbnail
  const title = `${prestige > 0 ? `✨ P${prestige} ` : ''}${username}`;
  addSectionWithThumbnail(container, `### ${title}`, avatarUrl);

  addSeparator(container, 'small');

  // Stats fields
  addFields(container, [
    { name: 'Rank', value: `#${rank}`, inline: true },
    { name: 'Level', value: `${level}`, inline: true },
    { name: 'Total XP', value: totalXp.toLocaleString(), inline: true },
    {
      name: `Progress — ${percentage}%`,
      value: `${bar}\n${currentXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`,
    },
  ]);

  if (prestige > 0) {
    addFooter(container, `Prestige ${prestige} • +${prestige * 5}% XP bonus`);
  }

  return container;
}

// ============================================
// Style Color Palettes
// ============================================

interface CardPalette {
  bg1: string;
  bg2: string;
  accent: string;
  accent2: string;
  text: string;
  textSecondary: string;
  barBg: string;
  barFill: string;
  barFill2: string;
}

const CARD_PALETTES: Record<string, CardPalette> = {
  default: {
    bg1: '#1a1a2e', bg2: '#16213e',
    accent: '#0f3460', accent2: '#e94560',
    text: '#FFFFFF', textSecondary: '#a0aec0',
    barBg: '#2d3748', barFill: '#e94560', barFill2: '#0f3460',
  },
  minimal: {
    bg1: '#1e1e1e', bg2: '#2d2d2d',
    accent: '#4a4a4a', accent2: '#FFFFFF',
    text: '#FFFFFF', textSecondary: '#b0b0b0',
    barBg: '#3a3a3a', barFill: '#FFFFFF', barFill2: '#888888',
  },
  neon: {
    bg1: '#0a0a0a', bg2: '#1a0a2e',
    accent: '#ff00ff', accent2: '#00ffff',
    text: '#FFFFFF', textSecondary: '#c0c0ff',
    barBg: '#1a1a3e', barFill: '#ff00ff', barFill2: '#00ffff',
  },
  galaxy: {
    bg1: '#0b0d17', bg2: '#1b1d3a',
    accent: '#7c3aed', accent2: '#f59e0b',
    text: '#FFFFFF', textSecondary: '#c4b5fd',
    barBg: '#1e1b4b', barFill: '#7c3aed', barFill2: '#f59e0b',
  },
  pastel: {
    bg1: '#fdf2f8', bg2: '#fce7f3',
    accent: '#ec4899', accent2: '#8b5cf6',
    text: '#1f2937', textSecondary: '#6b7280',
    barBg: '#e5e7eb', barFill: '#ec4899', barFill2: '#8b5cf6',
  },
};

// ============================================
// Canvas Rank Card Generator
// ============================================

export async function generateRankCard(params: {
  username: string;
  avatarUrl: string;
  level: number;
  currentXp: number;
  xpNeeded: number;
  totalXp: number;
  rank: number;
  prestige: number;
  style?: string;
  customBgUrl?: string;
}): Promise<AttachmentBuilder | null> {
  if (!createCanvas || !loadImage) return null;

  try {
    const {
      username, avatarUrl, level, currentXp, xpNeeded, totalXp, rank,
      prestige, style = 'default', customBgUrl,
    } = params;

    const width = 934;
    const height = 282;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const palette = CARD_PALETTES[style] || CARD_PALETTES.default;
    const percentage = Math.min(currentXp / xpNeeded, 1);

    // ── Background ──────────────────────────────────────────
    if (customBgUrl) {
      try {
        const bgImg = await loadImage(customBgUrl);
        ctx.drawImage(bgImg, 0, 0, width, height);
        // Dark overlay for readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, width, height);
      } catch {
        drawDefaultBackground(ctx, width, height, palette);
      }
    } else {
      drawDefaultBackground(ctx, width, height, palette);
    }

    // ── Decorative elements by style ────────────────────────
    if (style === 'neon') {
      drawNeonGlow(ctx, width, height, palette);
    } else if (style === 'galaxy') {
      drawStars(ctx, width, height);
    }

    // ── Avatar ──────────────────────────────────────────────
    const avatarSize = 140;
    const avatarX = 50;
    const avatarY = (height - avatarSize) / 2;

    try {
      const avatar = await loadImage(avatarUrl);

      // Avatar ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
      const ringGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
      ringGrad.addColorStop(0, palette.accent2);
      ringGrad.addColorStop(1, palette.barFill);
      ctx.fillStyle = ringGrad;
      ctx.fill();
      ctx.restore();

      // Clip circle and draw avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    } catch {
      // Draw placeholder circle if avatar load fails
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = palette.accent;
      ctx.fill();
    }

    // ── Text Area ───────────────────────────────────────────
    const textX = avatarX + avatarSize + 40;
    const textWidth = width - textX - 40;

    // Username
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.fillStyle = palette.text;
    ctx.textAlign = 'left';
    const displayName = username.length > 18 ? username.substring(0, 16) + '...' : username;
    ctx.fillText(displayName, textX, 65);

    // Prestige badge
    if (prestige > 0) {
      const nameWidth = ctx.measureText(displayName).width;
      ctx.font = 'bold 14px Arial, sans-serif';
      ctx.fillStyle = palette.accent2;
      ctx.fillText(`✨ P${prestige}`, textX + nameWidth + 12, 63);
    }

    // Rank & Level boxes
    const boxY = 80;
    drawStatBox(ctx, width - 200, boxY, 'RANK', `#${rank}`, palette);
    drawStatBox(ctx, width - 100, boxY, 'LEVEL', `${level}`, palette);

    // XP text
    ctx.font = '16px Arial, sans-serif';
    ctx.fillStyle = palette.textSecondary;
    ctx.textAlign = 'left';
    ctx.fillText(`${currentXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, textX, 160);

    // Total XP (right-aligned)
    ctx.textAlign = 'right';
    ctx.fillText(`Total: ${totalXp.toLocaleString()} XP`, width - 40, 160);

    // ── Progress Bar ────────────────────────────────────────
    const barX = textX;
    const barY = 175;
    const barWidth = textWidth;
    const barHeight = 28;
    const barRadius = barHeight / 2;

    // Bar background
    ctx.beginPath();
    roundRect(ctx, barX, barY, barWidth, barHeight, barRadius);
    ctx.fillStyle = palette.barBg;
    ctx.fill();

    // Bar fill with gradient
    if (percentage > 0) {
      const fillWidth = Math.max(barHeight, barWidth * percentage);
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, barX, barY, barWidth, barHeight, barRadius);
      ctx.clip();

      ctx.beginPath();
      roundRect(ctx, barX, barY, fillWidth, barHeight, barRadius);
      const barGrad = ctx.createLinearGradient(barX, 0, barX + fillWidth, 0);
      barGrad.addColorStop(0, palette.barFill);
      barGrad.addColorStop(1, palette.barFill2);
      ctx.fillStyle = barGrad;
      ctx.fill();
      ctx.restore();
    }

    // Percentage text on bar
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillStyle = palette.text;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(percentage * 100)}%`, barX + barWidth / 2, barY + 19);

    // ── Footer ──────────────────────────────────────────────
    ctx.font = '12px Arial, sans-serif';
    ctx.fillStyle = palette.textSecondary;
    ctx.textAlign = 'left';
    if (prestige > 0) {
      ctx.fillText(`Prestige ${prestige} • +${prestige * 5}% XP bonus`, textX, height - 20);
    }

    // Convert to buffer — @napi-rs/canvas uses encode(), node-canvas uses toBuffer()
    const buffer = typeof canvas.encode === 'function'
      ? await canvas.encode('png')
      : canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: 'rank-card.png' });
  } catch (error) {
    logger.error('Failed to generate rank card image:', error);
    return null;
  }
}

// ── Drawing Helpers ───────────────────────────────────────

function drawDefaultBackground(
  ctx: any, width: number, height: number, palette: CardPalette
): void {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.bg1);
  gradient.addColorStop(1, palette.bg2);
  ctx.fillStyle = gradient;
  // Rounded rectangle background
  roundRect(ctx, 0, 0, width, height, 20);
  ctx.fill();
}

function drawNeonGlow(ctx: any, width: number, height: number, palette: CardPalette): void {
  // Top and bottom neon lines
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = 15;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 5);
  ctx.lineTo(width - 20, 5);
  ctx.stroke();
  ctx.shadowColor = palette.accent2;
  ctx.strokeStyle = palette.accent2;
  ctx.beginPath();
  ctx.moveTo(20, height - 5);
  ctx.lineTo(width - 20, height - 5);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawStars(ctx: any, width: number, height: number): void {
  // Deterministic "random" stars
  for (let i = 0; i < 60; i++) {
    const x = ((i * 137) % width);
    const y = ((i * 73) % height);
    const size = (i % 3) + 1;
    const opacity = 0.3 + (i % 5) * 0.15;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.fill();
  }
}

function drawStatBox(
  ctx: any, x: number, y: number,
  label: string, value: string, palette: CardPalette
): void {
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.fillStyle = palette.textSecondary;
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y);

  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillStyle = palette.accent2;
  ctx.fillText(value, x, y + 28);
}

function roundRect(
  ctx: any, x: number, y: number,
  w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================
// Get User Card Preferences from Redis
// ============================================

export async function getUserCardStyle(guildId: string, userId: string): Promise<string> {
  try {
    const style = cache.get<string>(`cardstyle:${guildId}:${userId}`);
    return style || 'default';
  } catch {
    return 'default';
  }
}

export async function getUserCardBg(guildId: string, userId: string): Promise<string | null> {
  try {
    return cache.get<string>(`cardbg:${guildId}:${userId}`) || null;
  } catch {
    return null;
  }
}
