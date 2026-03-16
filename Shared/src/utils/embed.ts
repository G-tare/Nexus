import { EmbedBuilder, ColorResolvable } from 'discord.js';

/**
 * Standardized embed colors used across all modules.
 */
export const Colors = {
  Primary: 0x5865F2 as ColorResolvable,    // Discord blurple
  Success: 0x57F287 as ColorResolvable,     // Green
  Warning: 0xFEE75C as ColorResolvable,     // Yellow
  Error: 0xED4245 as ColorResolvable,       // Red
  Info: 0x5865F2 as ColorResolvable,        // Blue
  Moderation: 0xEB459E as ColorResolvable,  // Pink
  Economy: 0xF1C40F as ColorResolvable,     // Gold
  Leveling: 0x9B59B6 as ColorResolvable,    // Purple
  Music: 0x1DB954 as ColorResolvable,       // Spotify green
  Fun: 0xE67E22 as ColorResolvable,         // Orange
  Premium: 0xF47FFF as ColorResolvable,     // Light pink
} as const;

/**
 * Per-module unique embed colors for /help and /configs.
 * Each module gets its own distinct, visually appealing color.
 * Falls back to Discord blurple (0x5865F2) if module is unknown.
 */
export const MODULE_COLORS: Record<string, number> = {
  // Moderation family — reds/pinks
  moderation:        0xE74C3C, // Crimson red
  automod:           0xC0392B, // Dark red
  antiraid:          0xE91E63, // Hot pink
  logging:           0xAD1457, // Deep magenta

  // Engagement family — greens/teals
  leveling:          0x2ECC71, // Emerald
  reputation:        0x1ABC9C, // Turquoise
  activitytracking:  0x00BCD4, // Cyan
  leaderboards:      0x009688, // Teal
  counting:          0x26A69A, // Medium teal
  giveaways:         0x00E676, // Neon green
  polls:             0x4CAF50, // Green
  suggestions:       0x66BB6A, // Light green
  quoteboard:        0x81C784, // Soft green
  raffles:           0x43A047, // Forest green

  // Economy family — golds/ambers
  currency:          0xF1C40F, // Gold
  shop:              0xFFB300, // Amber
  casino:            0xFF8F00, // Dark amber
  donationtracking:  0xFFC107, // Yellow amber

  // Fun/Entertainment — oranges/warm
  fun:               0xE67E22, // Orange
  music:             0x1DB954, // Spotify green
  images:            0xFF7043, // Deep orange
  soundboard:        0xFF5722, // Red-orange
  aichatbot:         0x7C4DFF, // Deep purple

  // Social — purples/blues
  confessions:       0x9C27B0, // Purple
  profile:           0x7E57C2, // Medium purple
  family:            0xBA68C8, // Light purple
  birthdays:         0xCE93D8, // Lavender
  afk:               0x5C6BC0, // Indigo
  userphone:         0x42A5F5, // Sky blue
  voicephone:        0x29B6F6, // Light blue

  // Utility — blues/slates
  tickets:           0x3498DB, // Royal blue
  welcome:           0x2196F3, // Blue
  autoroles:         0x1976D2, // Dark blue
  reactionroles:     0x1565C0, // Deep blue
  colorroles:        0x7986CB, // Periwinkle
  backup:            0x546E7A, // Blue-grey
  reminders:         0x5E35B1, // Deep violet
  scheduledmessages: 0x4527A0, // Dark violet
  forms:             0x6A1B9A, // Dark purple
  customcommands:    0x00ACC1, // Dark cyan
  invitetracker:     0x0097A7, // Teal dark
  stickymessages:    0x00838F, // Deep teal
  tempvoice:         0x0288D1, // Light blue dark
  translation:       0x039BE5, // Light blue
  statschannels:     0x0277BD, // Dark light blue
  messagetracking:   0x01579B, // Very dark blue
  timers:            0x6D4C41, // Brown
  autosetup:         0x455A64, // Dark blue-grey
  utilities:         0x607D8B, // Blue grey

  // Core / Meta
  core:              0x5865F2, // Discord blurple
};

/** Default embed color when module colors are disabled. */
export const DEFAULT_EMBED_COLOR = 0x5865F2; // Discord blurple

/**
 * Get the embed color for a module. Returns the module-specific color
 * if useModuleColors is true, otherwise returns the default blurple.
 */
export function getModuleColor(moduleKey: string, useModuleColors = true): number {
  if (!useModuleColors) return DEFAULT_EMBED_COLOR;
  return MODULE_COLORS[moduleKey] ?? DEFAULT_EMBED_COLOR;
}

/**
 * Create a standardized success embed.
 */
export function successEmbed(title?: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(Colors.Success);
  if (title) embed.setTitle(`✅ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

/**
 * Create a standardized error embed.
 */
export function errorEmbed(title?: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(Colors.Error);
  if (title) embed.setTitle(`❌ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

/**
 * Create a standardized warning embed.
 */
export function warningEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(Colors.Warning)
    .setTitle(`⚠️ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

/**
 * Create a standardized info embed.
 */
export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(Colors.Info)
    .setTitle(title);
  if (description) embed.setDescription(description);
  return embed;
}

/**
 * Create a paginated embed helper.
 */
export function paginatedEmbed(
  items: string[],
  page: number,
  perPage: number,
  title: string,
  color: ColorResolvable = Colors.Primary
): { embed: EmbedBuilder; totalPages: number } {
  const totalPages = Math.ceil(items.length / perPage);
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const start = (currentPage - 1) * perPage;
  const pageItems = items.slice(start, start + perPage);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(pageItems.join('\n') || 'No items to display.')
    .setFooter({ text: `Page ${currentPage}/${totalPages} • ${items.length} total` });

  return { embed, totalPages };
}
