import {
  Guild,
  Role,
  GuildMember,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import { getDb } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { eq, and, sql, asc, desc } from 'drizzle-orm';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { moduleContainer, addText, v2Payload } from '../../Shared/src/utils/componentsV2';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('ColorRoles');

// ============================================
// Config Interface
// ============================================

export interface ColorRolesConfig {
  // Whether the module is enabled
  enabled: boolean;

  // Auto-assign a color on join (null = disabled, 'random' = random, or a color ID)
  joinColor: null | 'random' | number;

  // Whether to show DM/ephemeral messages when reacting to color lists
  reactionMessages: boolean;

  // Whether to auto-delete bot responses after a delay
  deleteResponses: boolean;
  deleteResponseDelay: number; // seconds

  // Channel restriction (null = any channel)
  commandChannelId: string | null;

  // Roles that can manage colors (in addition to admins)
  managementRoleIds: string[];

  // Color whitelist — if enabled, only these roles can use color commands
  whitelistEnabled: boolean;
  whitelistRoleIds: string[];

  // Warn when adding colors too similar to existing ones
  overlapWarning: boolean;
  overlapThreshold: number; // 0-100, how similar colors need to be to trigger warning

  // Where color roles should be positioned in the role hierarchy
  // 'above' a specific role, 'below' a specific role, or null for default
  colorRoleAnchorId: string | null;
  colorRolePosition: 'above' | 'below';

  // Max colors the server can have
  maxColors: number;
}

export const DEFAULT_COLOR_CONFIG: ColorRolesConfig = {
  enabled: true,
  joinColor: null,
  reactionMessages: true,
  deleteResponses: false,
  deleteResponseDelay: 10,
  commandChannelId: null,
  managementRoleIds: [],
  whitelistEnabled: false,
  whitelistRoleIds: [],
  overlapWarning: true,
  overlapThreshold: 15,
  colorRoleAnchorId: null,
  colorRolePosition: 'below',
  maxColors: 50,
};

// ============================================
// Color Data Types
// ============================================

export interface ColorEntry {
  id: number;
  guildId: string;
  name: string;
  hex: string; // stored without #, e.g. "FF69B4"
  roleId: string; // the Discord role ID
  position: number; // order in the palette
  createdBy: string; // user ID who added it
  createdAt: Date;
}

export interface ReactionColorList {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string;
  colorIds: number[]; // which colors are in this reaction message
  createdAt: Date;
}

export interface ColorSave {
  id: number;
  guildId: string;
  name: string;
  colors: Array<{ name: string; hex: string }>;
  createdBy: string;
  createdAt: Date;
  exportCode: string | null;
}

// ============================================
// Color Validation
// ============================================

/**
 * Validate a hex color string. Accepts with or without #.
 * Returns the 6-char hex (uppercase, no #) or null if invalid.
 */
export function validateHex(input: string): string | null {
  const cleaned = input.replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{6}$/.test(cleaned)) return cleaned;
  if (/^[0-9A-F]{3}$/.test(cleaned)) {
    // Expand shorthand: ABC -> AABBCC
    return cleaned.split('').map(c => c + c).join('');
  }
  return null;
}

/**
 * Convert RGB values (0-255) to hex string.
 */
export function rgbToHex(r: number, g: number, b: number): string | null {
  if ([r, g, b].some(v => v < 0 || v > 255 || !Number.isInteger(v))) return null;
  return [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Parse hex to RGB.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/**
 * Convert hex to integer for Discord role color.
 */
export function hexToInt(hex: string): number {
  return parseInt(hex.replace(/^#/, ''), 16);
}

/**
 * Generate a random hex color.
 */
export function randomHex(): string {
  return Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase();
}

// ============================================
// Color Similarity (Overlap Detection)
// ============================================

/**
 * Calculate the perceptual distance between two colors using CIE76 delta E.
 * Returns a value from 0 (identical) to ~100+ (very different).
 * For our overlap detection, we simplify to weighted Euclidean in RGB space.
 */
export function colorDistance(hex1: string, hex2: string): number {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);

  // Weighted Euclidean distance (human eyes are more sensitive to green)
  const rMean = (c1.r + c2.r) / 2;
  const dR = c1.r - c2.r;
  const dG = c1.g - c2.g;
  const dB = c1.b - c2.b;

  // Redmean color distance formula — more perceptually accurate than simple Euclidean
  const distance = Math.sqrt(
    (2 + rMean / 256) * dR * dR +
    4 * dG * dG +
    (2 + (255 - rMean) / 256) * dB * dB
  );

  // Normalize to 0-100 scale (max possible ~764)
  return Math.min(100, (distance / 764) * 100);
}

/**
 * Check if a color is too similar to any existing colors.
 * Returns the similar color if found, null otherwise.
 */
export async function findSimilarColor(
  guildId: string,
  hex: string,
  threshold: number
): Promise<ColorEntry | null> {
  const colors = await getColorPalette(guildId);

  for (const color of colors) {
    const dist = colorDistance(hex, color.hex);
    if (dist < threshold) return color;
  }

  return null;
}

// ============================================
// Color Palette CRUD
// ============================================

/**
 * Get all colors in a guild's palette, ordered by position.
 */
export async function getColorPalette(guildId: string): Promise<ColorEntry[]> {
  const db = getDb();

  // Try cache first
  const cached = await cache.get<ColorEntry[]>(`colors:palette:${guildId}`);
  if (cached) {
    return cached;
  }

  const rows = await db.execute(sql`
    SELECT id, guild_id as "guildId", name, hex, role_id as "roleId",
           position, created_by as "createdBy", created_at as "createdAt"
    FROM color_roles
    WHERE guild_id = ${guildId}
    ORDER BY position ASC
  `);

  const colors = (rows as any).rows || rows || [];

  // Cache for 5 minutes
  await cache.set(`colors:palette:${guildId}`, colors, 300);

  return colors;
}

/**
 * Get a single color by ID.
 */
export async function getColorById(guildId: string, colorId: number): Promise<ColorEntry | null> {
  const db = getDb();
  const [row] = (await db.execute(sql`
    SELECT id, guild_id as "guildId", name, hex, role_id as "roleId",
           position, created_by as "createdBy", created_at as "createdAt"
    FROM color_roles
    WHERE guild_id = ${guildId} AND id = ${colorId}
  `) as any).rows || [];

  return row || null;
}

/**
 * Find a color by name (case-insensitive).
 */
export async function getColorByName(guildId: string, name: string): Promise<ColorEntry | null> {
  const colors = await getColorPalette(guildId);
  return colors.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
}

/**
 * Find a color by its Discord role ID.
 */
export async function getColorByRoleId(guildId: string, roleId: string): Promise<ColorEntry | null> {
  const colors = await getColorPalette(guildId);
  return colors.find(c => c.roleId === roleId) || null;
}

/**
 * Get the next position number for a new color.
 */
async function getNextPosition(guildId: string): Promise<number> {
  const db = getDb();
  const [result] = (await db.execute(sql`
    SELECT COALESCE(MAX(position), 0) + 1 as next_pos
    FROM color_roles
    WHERE guild_id = ${guildId}
  `) as any).rows || [];

  return result?.next_pos || 1;
}

/**
 * Add a color to the palette.
 * Creates the Discord role and stores the color entry.
 */
export async function addColor(params: {
  guild: Guild;
  name: string;
  hex: string;
  createdBy: string;
}): Promise<ColorEntry> {
  const db = getDb();
  const { guild, name, hex, createdBy } = params;

  // Create the Discord role
  const config = await getColorConfig(guild.id);
  let rolePosition: number | undefined;

  if (config.colorRoleAnchorId) {
    const anchorRole = guild.roles.cache.get(config.colorRoleAnchorId);
    if (anchorRole) {
      rolePosition = config.colorRolePosition === 'above'
        ? anchorRole.position + 1
        : anchorRole.position;
    }
  }

  const role = await guild.roles.create({
    name: `🎨 ${name}`,
    color: hexToInt(hex),
    reason: `Color role added by <@${createdBy}>`,
    position: rolePosition,
    mentionable: false,
    hoist: false,
  });

  // Get next position
  const position = await getNextPosition(guild.id);

  // Insert into database
  const [inserted] = (await db.execute(sql`
    INSERT INTO color_roles (guild_id, name, hex, role_id, position, created_by, created_at)
    VALUES (${guild.id}, ${name}, ${hex}, ${role.id}, ${position}, ${createdBy}, NOW())
    RETURNING id, guild_id as "guildId", name, hex, role_id as "roleId",
              position, created_by as "createdBy", created_at as "createdAt"
  `) as any).rows || [];

  // Invalidate cache
  await cache.del(`colors:palette:${guild.id}`);

  // Emit event
  eventBus.emit('colorAdded' as any, {
    guildId: guild.id,
    colorName: name,
    hex,
    roleId: role.id,
    addedBy: createdBy,
  });

  logger.info('Color added', { guildId: guild.id, name, hex, roleId: role.id });

  return inserted;
}

/**
 * Add an existing Discord role as a color.
 */
export async function addExistingRoleAsColor(params: {
  guild: Guild;
  role: Role;
  name: string;
  createdBy: string;
}): Promise<ColorEntry> {
  const db = getDb();
  const { guild, role, name, createdBy } = params;

  const hex = role.hexColor.replace('#', '').toUpperCase() || '000000';
  const position = await getNextPosition(guild.id);

  const [inserted] = (await db.execute(sql`
    INSERT INTO color_roles (guild_id, name, hex, role_id, position, created_by, created_at)
    VALUES (${guild.id}, ${name}, ${hex}, ${role.id}, ${position}, ${createdBy}, NOW())
    RETURNING id, guild_id as "guildId", name, hex, role_id as "roleId",
              position, created_by as "createdBy", created_at as "createdAt"
  `) as any).rows || [];

  await cache.del(`colors:palette:${guild.id}`);

  eventBus.emit('colorAdded' as any, {
    guildId: guild.id,
    colorName: name,
    hex,
    roleId: role.id,
    addedBy: createdBy,
  });

  return inserted;
}

/**
 * Edit a color (name and/or hex).
 */
export async function editColor(params: {
  guild: Guild;
  colorId: number;
  newName?: string;
  newHex?: string;
}): Promise<ColorEntry | null> {
  const db = getDb();
  const { guild, colorId, newName, newHex } = params;

  const existing = await getColorById(guild.id, colorId);
  if (!existing) return null;

  const name = newName || existing.name;
  const hex = newHex || existing.hex;

  // Update Discord role
  const role = guild.roles.cache.get(existing.roleId);
  if (role) {
    await role.edit({
      name: `🎨 ${name}`,
      color: hexToInt(hex),
      reason: 'Color role edited',
    });
  }

  // Update database
  await db.execute(sql`
    UPDATE color_roles
    SET name = ${name}, hex = ${hex}
    WHERE guild_id = ${guild.id} AND id = ${colorId}
  `);

  await cache.del(`colors:palette:${guild.id}`);

  return { ...existing, name, hex };
}

/**
 * Delete a color from the palette and remove the Discord role.
 */
export async function deleteColor(guild: Guild, colorId: number): Promise<boolean> {
  const db = getDb();

  const color = await getColorById(guild.id, colorId);
  if (!color) return false;

  // Delete the Discord role
  const role = guild.roles.cache.get(color.roleId);
  if (role) {
    try {
      await role.delete('Color role removed from palette');
    } catch (err: any) {
      logger.warn('Could not delete color role from Discord', { error: err.message });
    }
  }

  // Remove from reaction color lists
  await db.execute(sql`
    UPDATE color_reaction_lists
    SET color_ids = array_remove(color_ids, ${colorId})
    WHERE guild_id = ${guild.id}
  `);

  // Delete from database
  await db.execute(sql`
    DELETE FROM color_roles
    WHERE guild_id = ${guild.id} AND id = ${colorId}
  `);

  await cache.del(`colors:palette:${guild.id}`);

  eventBus.emit('colorRemoved' as any, {
    guildId: guild.id,
    colorName: color.name,
    hex: color.hex,
  });

  return true;
}

/**
 * Clear all colors from a guild's palette.
 */
export async function clearAllColors(guild: Guild): Promise<number> {
  const db = getDb();

  const colors = await getColorPalette(guild.id);

  // Delete all Discord roles
  for (const color of colors) {
    const role = guild.roles.cache.get(color.roleId);
    if (role) {
      try {
        await role.delete('Color palette cleared');
      } catch { /* continue */ }
    }
  }

  // Clear reaction lists
  await db.execute(sql`DELETE FROM color_reaction_lists WHERE guild_id = ${guild.id}`);

  // Delete all colors
  await db.execute(sql`DELETE FROM color_roles WHERE guild_id = ${guild.id}`);

  await cache.del(`colors:palette:${guild.id}`);

  return colors.length;
}

// ============================================
// Color Assignment
// ============================================

/**
 * Get a member's current color role (if any).
 */
export async function getMemberColor(guild: Guild, memberId: string): Promise<ColorEntry | null> {
  const colors = await getColorPalette(guild.id);
  const member = await guild.members.fetch(memberId).catch(() => null);
  if (!member) return null;

  for (const color of colors) {
    if (member.roles.cache.has(color.roleId)) return color;
  }

  return null;
}

/**
 * Assign a color to a member. Removes any existing color roles first.
 */
export async function assignColor(guild: Guild, memberId: string, colorId: number): Promise<ColorEntry | null> {
  const color = await getColorById(guild.id, colorId);
  if (!color) return null;

  const member = await guild.members.fetch(memberId).catch(() => null);
  if (!member) return null;

  // Remove existing color roles
  const colors = await getColorPalette(guild.id);
  const colorRoleIds = colors.map(c => c.roleId);
  const rolesToRemove = member.roles.cache.filter(r => colorRoleIds.includes(r.id));

  if (rolesToRemove.size > 0) {
    await member.roles.remove(rolesToRemove, 'Switching color role');
  }

  // Add new color role
  await member.roles.add(color.roleId, `Color set to ${color.name}`);

  eventBus.emit('colorAssigned' as any, {
    guildId: guild.id,
    userId: memberId,
    colorName: color.name,
    hex: color.hex,
  });

  return color;
}

/**
 * Remove all color roles from a member.
 */
export async function removeColor(guild: Guild, memberId: string): Promise<boolean> {
  const member = await guild.members.fetch(memberId).catch(() => null);
  if (!member) return false;

  const colors = await getColorPalette(guild.id);
  const colorRoleIds = colors.map(c => c.roleId);
  const rolesToRemove = member.roles.cache.filter(r => colorRoleIds.includes(r.id));

  if (rolesToRemove.size === 0) return false;

  await member.roles.remove(rolesToRemove, 'Color role removed');

  return true;
}

// ============================================
// Palette Image Generation
// ============================================

/**
 * Generate a color palette image showing all colors with swatches, names, and hex values.
 * Uses Canvas to create a visual grid similar to Color-Chan's palette display.
 *
 * Layout: Grid of color blocks, each with:
 * - Colored rectangle swatch
 * - Color name text
 * - Hex value text
 * - Number indicator
 */
export async function generatePaletteImage(guildId: string): Promise<Buffer> {
  // Dynamic import canvas (needs to be installed)
  const { createCanvas } = await import('canvas');

  const colors = await getColorPalette(guildId);
  if (colors.length === 0) {
    // Create a simple "No colors" image
    const canvas = createCanvas(400, 100);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2C2F33';
    ctx.fillRect(0, 0, 400, 100);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No colors in palette', 200, 55);
    return canvas.toBuffer('image/png');
  }

  // Layout constants
  const COLS = Math.min(colors.length, 4); // max 4 columns
  const ROWS = Math.ceil(colors.length / COLS);
  const SWATCH_W = 200;
  const SWATCH_H = 80;
  const PADDING = 12;
  const HEADER_H = 50;
  const CANVAS_W = COLS * (SWATCH_W + PADDING) + PADDING;
  const CANVAS_H = HEADER_H + ROWS * (SWATCH_H + PADDING) + PADDING;

  const canvas = createCanvas(CANVAS_W, CANVAS_H);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#2C2F33';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Header
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Color Palette', CANVAS_W / 2, 33);

  // Draw each color
  for (let i = 0; i < colors.length; i++) {
    const color = colors[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const x = PADDING + col * (SWATCH_W + PADDING);
    const y = HEADER_H + PADDING + row * (SWATCH_H + PADDING);

    // Swatch background with rounded corners
    ctx.fillStyle = `#${color.hex}`;
    ctx.beginPath();
    ctx.roundRect(x, y, SWATCH_W, SWATCH_H, 8);
    ctx.fill();

    // Determine text color based on brightness
    const rgb = hexToRgb(color.hex);
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    const textColor = brightness > 128 ? '#000000' : '#FFFFFF';

    // Number badge
    ctx.fillStyle = brightness > 128 ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(x + 18, y + 18, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${i + 1}`, x + 18, y + 22);

    // Color name
    ctx.fillStyle = textColor;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      color.name.length > 18 ? color.name.slice(0, 16) + '...' : color.name,
      x + SWATCH_W / 2,
      y + 38
    );

    // Hex value
    ctx.font = '13px monospace';
    ctx.fillText(`#${color.hex}`, x + SWATCH_W / 2, y + 58);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Generate palette image as a Discord attachment.
 */
export async function generatePaletteAttachment(guildId: string): Promise<AttachmentBuilder> {
  const buffer = await generatePaletteImage(guildId);
  return new AttachmentBuilder(buffer, { name: 'color-palette.png' });
}

// ============================================
// Reaction Color Lists
// ============================================

/**
 * Get all reaction color lists for a guild.
 */
export async function getReactionLists(guildId: string): Promise<ReactionColorList[]> {
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT id, guild_id as "guildId", channel_id as "channelId",
           message_id as "messageId", color_ids as "colorIds", created_at as "createdAt"
    FROM color_reaction_lists
    WHERE guild_id = ${guildId}
    ORDER BY created_at DESC
  `) as any).rows || [];

  return rows;
}

/**
 * Create a reaction color list message.
 * Posts the palette image in the specified channel with number reactions.
 */
export async function createReactionList(params: {
  guild: Guild;
  channelId: string;
  colorIds?: number[]; // specific colors, or all if omitted
}): Promise<ReactionColorList | null> {
  const db = getDb();
  const { guild, channelId } = params;

  const allColors = await getColorPalette(guild.id);
  if (allColors.length === 0) return null;

  const colorIds = params.colorIds || allColors.map(c => c.id);
  const colors = allColors.filter(c => colorIds.includes(c.id));
  if (colors.length === 0) return null;

  // Cap at 20 colors per reaction message (Discord reaction limit)
  const colorsToUse = colors.slice(0, 20);

  const channel = await guild.channels.fetch(channelId);
  if (!channel?.isTextBased()) return null;

  // Generate the palette image for these specific colors
  const attachment = await generatePaletteAttachment(guild.id);

  const container = moduleContainer('color_roles').setAccentColor(hexToInt(colorsToUse[0].hex));
  addText(container, '### 🎨 Color Roles');
  addText(container, 'React with the corresponding number to get a color role!\n\n' +
      colorsToUse.map((c, i) => `${numberEmoji(i + 1)} **${c.name}** — \`#${c.hex}\``).join('\n'));

  const msg = await (channel as any).send({
    components: [container],
    files: [attachment],
    flags: MessageFlags.IsComponentsV2,
  });

  // Add number reactions
  for (let i = 0; i < colorsToUse.length; i++) {
    try {
      await msg.react(numberEmoji(i + 1));
    } catch { /* may fail if bot lacks permissions */ }
  }

  // Store in database
  const [inserted] = (await db.execute(sql`
    INSERT INTO color_reaction_lists (guild_id, channel_id, message_id, color_ids, created_at)
    VALUES (${guild.id}, ${channelId}, ${msg.id}, ${sql`ARRAY[${sql.join(colorIds.map(id => sql`${id}`), sql`, `)}]::int[]`}, NOW())
    RETURNING id, guild_id as "guildId", channel_id as "channelId",
              message_id as "messageId", color_ids as "colorIds", created_at as "createdAt"
  `) as any).rows || [];

  return inserted || null;
}

/**
 * Delete a reaction color list.
 */
export async function deleteReactionList(guild: Guild, listId: number): Promise<boolean> {
  const db = getDb();

  const lists = await getReactionLists(guild.id);
  const list = lists.find(l => l.id === listId);
  if (!list) return false;

  // Try to delete the Discord message
  try {
    const channel = await guild.channels.fetch(list.channelId);
    if (channel?.isTextBased()) {
      const msg = await (channel as any).messages.fetch(list.messageId);
      if (msg) await msg.delete();
    }
  } catch { /* message might already be deleted */ }

  await db.execute(sql`
    DELETE FROM color_reaction_lists
    WHERE guild_id = ${guild.id} AND id = ${listId}
  `);

  return true;
}

/**
 * Clear all reaction lists for a guild.
 */
export async function clearReactionLists(guild: Guild): Promise<number> {
  const db = getDb();
  const lists = await getReactionLists(guild.id);

  // Try to delete all Discord messages
  for (const list of lists) {
    try {
      const channel = await guild.channels.fetch(list.channelId);
      if (channel?.isTextBased()) {
        const msg = await (channel as any).messages.fetch(list.messageId);
        if (msg) await msg.delete();
      }
    } catch { /* continue */ }
  }

  await db.execute(sql`DELETE FROM color_reaction_lists WHERE guild_id = ${guild.id}`);

  return lists.length;
}

// ============================================
// Save / Export / Import
// ============================================

/**
 * Save the current palette.
 */
export async function savePalette(guildId: string, name: string, userId: string): Promise<ColorSave> {
  const db = getDb();
  const colors = await getColorPalette(guildId);

  const colorData = colors.map(c => ({ name: c.name, hex: c.hex }));

  const [save] = (await db.execute(sql`
    INSERT INTO color_saves (guild_id, name, colors, created_by, created_at)
    VALUES (${guildId}, ${name}, ${JSON.stringify(colorData)}::jsonb, ${userId}, NOW())
    RETURNING id, guild_id as "guildId", name, colors, created_by as "createdBy",
              created_at as "createdAt", export_code as "exportCode"
  `) as any).rows || [];

  return save;
}

/**
 * Get all saves for a guild.
 */
export async function getSaves(guildId: string): Promise<ColorSave[]> {
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT id, guild_id as "guildId", name, colors, created_by as "createdBy",
           created_at as "createdAt", export_code as "exportCode"
    FROM color_saves
    WHERE guild_id = ${guildId}
    ORDER BY created_at DESC
    LIMIT 20
  `) as any).rows || [];

  return rows;
}

/**
 * Restore a save — clears current palette and recreates from save.
 */
export async function restoreSave(guild: Guild, saveId: number): Promise<boolean> {
  const db = getDb();

  const [save] = (await db.execute(sql`
    SELECT colors FROM color_saves
    WHERE guild_id = ${guild.id} AND id = ${saveId}
  `) as any).rows || [];

  if (!save) return false;

  const colorData = typeof save.colors === 'string' ? JSON.parse(save.colors) : save.colors;

  // Clear current palette
  await clearAllColors(guild);

  // Recreate each color
  for (const c of colorData) {
    try {
      await addColor({
        guild,
        name: c.name,
        hex: c.hex,
        createdBy: 'system',
      });
    } catch (err: any) {
      logger.warn('Failed to restore color', { name: c.name, error: err.message });
    }
  }

  return true;
}

/**
 * Generate an export code for the current palette.
 */
export async function exportPalette(guildId: string): Promise<string> {
  const colors = await getColorPalette(guildId);
  const data = colors.map(c => ({ n: c.name, h: c.hex }));
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * Import a palette from an export code.
 */
export async function importPalette(guild: Guild, code: string, userId: string): Promise<number> {
  try {
    const data = JSON.parse(Buffer.from(code, 'base64').toString('utf-8'));
    if (!Array.isArray(data)) throw new Error('Invalid format');

    let count = 0;
    for (const entry of data) {
      if (!entry.n || !entry.h) continue;
      const hex = validateHex(entry.h);
      if (!hex) continue;

      try {
        await addColor({ guild, name: entry.n, hex, createdBy: userId });
        count++;
      } catch { /* skip duplicates */ }
    }

    return count;
  } catch {
    return 0;
  }
}

// ============================================
// Default Colors
// ============================================

export const DEFAULT_COLORS: Array<{ name: string; hex: string }> = [
  { name: 'Red', hex: 'E74C3C' },
  { name: 'Crimson', hex: 'DC143C' },
  { name: 'Orange', hex: 'E67E22' },
  { name: 'Gold', hex: 'F1C40F' },
  { name: 'Yellow', hex: 'FFFF00' },
  { name: 'Lime', hex: '2ECC71' },
  { name: 'Green', hex: '27AE60' },
  { name: 'Teal', hex: '1ABC9C' },
  { name: 'Cyan', hex: '00BCD4' },
  { name: 'Sky Blue', hex: '3498DB' },
  { name: 'Blue', hex: '2980B9' },
  { name: 'Indigo', hex: '3F51B5' },
  { name: 'Purple', hex: '9B59B6' },
  { name: 'Violet', hex: '8E44AD' },
  { name: 'Pink', hex: 'FF69B4' },
  { name: 'Hot Pink', hex: 'E91E63' },
];

// ============================================
// Utility: Number Emojis
// ============================================

const NUMBER_EMOJIS = [
  '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣',
  '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟',
  '🇦', '🇧', '🇨', '🇩', '🇪',
  '🇫', '🇬', '🇭', '🇮', '🇯',
];

export function numberEmoji(n: number): string {
  return NUMBER_EMOJIS[n - 1] || `${n}`;
}

/**
 * Get the color index from a reaction emoji.
 */
export function emojiToIndex(emoji: string): number {
  const idx = NUMBER_EMOJIS.indexOf(emoji);
  return idx >= 0 ? idx : -1;
}

// ============================================
// Config Helper
// ============================================

/**
 * Get the color roles config for a guild.
 */
export async function getColorConfig(guildId: string): Promise<ColorRolesConfig> {
  const cfg = await moduleConfig.getModuleConfig<ColorRolesConfig>(guildId, 'colorroles');
  return { ...DEFAULT_COLOR_CONFIG, ...(cfg?.config || {}) };
}

/**
 * Check if a member can use color commands (whitelist check).
 */
export async function canUseColors(guild: Guild, memberId: string): Promise<boolean> {
  const config = await getColorConfig(guild.id);
  if (!config.whitelistEnabled) return true;

  const member = await guild.members.fetch(memberId).catch(() => null);
  if (!member) return false;

  return config.whitelistRoleIds.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Check if a member can manage colors (management role check).
 */
export async function canManageColors(guild: Guild, memberId: string): Promise<boolean> {
  const member = await guild.members.fetch(memberId).catch(() => null);
  if (!member) return false;

  // Server admins can always manage
  if (member.permissions.has('Administrator')) return true;
  if (member.permissions.has('ManageRoles')) return true;

  // Check management roles
  const config = await getColorConfig(guild.id);
  return config.managementRoleIds.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Count members who have a specific color role.
 */
export async function getColorMemberCount(guild: Guild, roleId: string): Promise<number> {
  const role = guild.roles.cache.get(roleId);
  if (!role) return 0;
  return role.members.size;
}
