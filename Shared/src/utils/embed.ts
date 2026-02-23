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
