/**
 * Components V2 Utility System
 *
 * Drop-in replacement for embed.ts using Discord's Components V2 system.
 * All messages use ContainerBuilder with accent colors instead of EmbedBuilder.
 *
 * Components V2 requires MessageFlags.IsComponentsV2 on every message.
 * When using V2, you CANNOT include `content`, `embeds`, `stickers`, or `poll`.
 * Only `components` and `files` arrays are allowed.
 *
 * Nesting rules:
 * - Container (top level) can hold: TextDisplay, Section, Separator, ActionRow, MediaGallery, File
 * - Section can hold: 1-3 TextDisplay + optional Thumbnail or Button accessory
 * - ActionRow: up to 5 buttons OR 1 select menu (not both)
 * - Max 10 top-level components, 40 total nested, 4000 chars across all TextDisplays
 */

import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  FileBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  MessageFlags,
  AttachmentBuilder,
  type APIContainerComponent,
} from 'discord.js';

import { MODULE_COLORS, DEFAULT_EMBED_COLOR } from './embed';

/* ── Re-export Colors for backward compat ── */
export { MODULE_COLORS, DEFAULT_EMBED_COLOR } from './embed';

/* ── Color Constants ── */
export const V2Colors = {
  Primary:    0x5865F2,  // Discord blurple
  Success:    0x57F287,  // Green
  Warning:    0xFEE75C,  // Yellow
  Error:      0xED4245,  // Red
  Info:       0x5865F2,  // Blue
  Moderation: 0xEB459E,  // Pink
  Economy:    0xF1C40F,  // Gold
  Leveling:   0x9B59B6,  // Purple
  Music:      0x1DB954,  // Spotify green
  Fun:        0xE67E22,  // Orange
  Premium:    0xF47FFF,  // Light pink
} as const;

/* ── Type Aliases ── */
type AnyActionRow = ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder | ChannelSelectMenuBuilder | RoleSelectMenuBuilder>;

/**
 * Content for a V2 message — used by InteractiveSession and direct replies.
 */
export interface V2MessageContent {
  containers: ContainerBuilder[];
  files?: AttachmentBuilder[];
  flags: typeof MessageFlags.IsComponentsV2;
}

/**
 * Build the reply/edit payload for V2 messages.
 */
export function v2Payload(
  containers: ContainerBuilder[],
  files?: AttachmentBuilder[],
): { components: ContainerBuilder[]; files: AttachmentBuilder[]; flags: typeof MessageFlags.IsComponentsV2 } {
  return {
    components: containers,
    files: files ?? [],
    flags: MessageFlags.IsComponentsV2,
  };
}

/* ─────────────────────────────────────────────
 * Module color helper
 * ───────────────────────────────────────────── */

export function getModuleAccentColor(moduleKey: string, useModuleColors = true): number {
  if (!useModuleColors) return DEFAULT_EMBED_COLOR;
  return MODULE_COLORS[moduleKey] ?? DEFAULT_EMBED_COLOR;
}

/* ─────────────────────────────────────────────
 * Quick Container Builders (replace successEmbed, errorEmbed, etc.)
 * ───────────────────────────────────────────── */

/**
 * Create a success container with green accent.
 */
export function successContainer(title?: string, description?: string): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(V2Colors.Success);
  const text = [
    title ? `### ✅ ${title}` : '',
    description ?? '',
  ].filter(Boolean).join('\n');
  if (text) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  }
  return container;
}

/**
 * Create an error container with red accent.
 */
export function errorContainer(title?: string, description?: string): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(V2Colors.Error);
  const text = [
    title ? `### ❌ ${title}` : '',
    description ?? '',
  ].filter(Boolean).join('\n');
  if (text) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  }
  return container;
}

/**
 * Create a warning container with yellow accent.
 */
export function warningContainer(title: string, description?: string): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(V2Colors.Warning);
  const text = [
    `### ⚠️ ${title}`,
    description ?? '',
  ].filter(Boolean).join('\n');
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return container;
}

/**
 * Create an info container with blue accent.
 */
export function infoContainer(title: string, description?: string): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(V2Colors.Info);
  const text = [
    `### ${title}`,
    description ?? '',
  ].filter(Boolean).join('\n');
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return container;
}

/* ─────────────────────────────────────────────
 * Rich Container Builder — for complex layouts
 * ───────────────────────────────────────────── */

/**
 * Create a module-branded container with the module's accent color.
 */
export function moduleContainer(moduleKey: string, useModuleColors = true): ContainerBuilder {
  return new ContainerBuilder().setAccentColor(getModuleAccentColor(moduleKey, useModuleColors));
}

/**
 * Add a title section with an optional thumbnail image.
 */
export function addTitleSection(
  container: ContainerBuilder,
  title: string,
  subtitle?: string,
  thumbnailUrl?: string,
): ContainerBuilder {
  const text = subtitle
    ? `### ${title}\n${subtitle}`
    : `### ${title}`;

  if (thumbnailUrl) {
    const section = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl));
    container.addSectionComponents(section);
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  }

  return container;
}

/**
 * Add a divider/separator to a container.
 */
export function addSeparator(
  container: ContainerBuilder,
  spacing: 'small' | 'large' = 'small',
  divider = true,
): ContainerBuilder {
  const sep = new SeparatorBuilder()
    .setSpacing(spacing === 'large' ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small)
    .setDivider(divider);
  container.addSeparatorComponents(sep);
  return container;
}

/**
 * Add plain text to a container.
 */
export function addText(container: ContainerBuilder, content: string): ContainerBuilder {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
  return container;
}

/**
 * Add a key-value field section (like embed fields).
 * Uses bold label + value on same line or next line.
 */
export function addField(
  container: ContainerBuilder,
  name: string,
  value: string,
  inline = false,
): ContainerBuilder {
  const text = inline
    ? `**${name}:** ${value}`
    : `**${name}**\n${value}`;
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return container;
}

/**
 * Add multiple fields as a single text display (saves component count).
 */
export function addFields(
  container: ContainerBuilder,
  fields: Array<{ name: string; value: string; inline?: boolean }>,
): ContainerBuilder {
  const lines = fields.map(f =>
    f.inline ? `**${f.name}:** ${f.value}` : `**${f.name}**\n${f.value}`
  );
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
  return container;
}

/**
 * Add a section with text and a thumbnail accessory (like embed with setThumbnail).
 */
export function addSectionWithThumbnail(
  container: ContainerBuilder,
  content: string,
  thumbnailUrl: string,
): ContainerBuilder {
  const section = new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl));
  container.addSectionComponents(section);
  return container;
}

/**
 * Add a section with text and a button accessory.
 */
export function addSectionWithButton(
  container: ContainerBuilder,
  content: string,
  button: ButtonBuilder,
): ContainerBuilder {
  const section = new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
    .setButtonAccessory(button);
  container.addSectionComponents(section);
  return container;
}

/**
 * Add an action row with buttons to a container.
 */
export function addButtons(
  container: ContainerBuilder,
  buttons: ButtonBuilder[],
): ContainerBuilder {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
  container.addActionRowComponents(row);
  return container;
}

/**
 * Add an action row with a select menu to a container.
 */
export function addSelectMenu(
  container: ContainerBuilder,
  menu: StringSelectMenuBuilder | ChannelSelectMenuBuilder | RoleSelectMenuBuilder,
): ContainerBuilder {
  const row = new ActionRowBuilder<typeof menu>().addComponents(menu);
  container.addActionRowComponents(row as any);
  return container;
}

/**
 * Add a media gallery (for images/videos) to a container.
 */
export function addMediaGallery(
  container: ContainerBuilder,
  items: Array<{ url: string; description?: string; spoiler?: boolean }>,
): ContainerBuilder {
  const gallery = new MediaGalleryBuilder();
  for (const item of items) {
    const galleryItem = new MediaGalleryItemBuilder().setURL(item.url);
    if (item.description) galleryItem.setDescription(item.description);
    if (item.spoiler) galleryItem.setSpoiler(true);
    gallery.addItems(galleryItem);
  }
  container.addMediaGalleryComponents(gallery);
  return container;
}

/**
 * Add a file component to a container.
 */
export function addFileComponent(
  container: ContainerBuilder,
  url: string,
  spoiler = false,
): ContainerBuilder {
  const file = new FileBuilder().setURL(url);
  if (spoiler) file.setSpoiler(true);
  container.addFileComponents(file);
  return container;
}

/**
 * Add a footer-like text at the bottom (dimmed with separator).
 */
export function addFooter(container: ContainerBuilder, text: string): ContainerBuilder {
  addSeparator(container, 'small', true);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${text}`),
  );
  return container;
}

/* ─────────────────────────────────────────────
 * Paginated Container
 * ───────────────────────────────────────────── */

export function paginatedContainer(
  items: string[],
  page: number,
  perPage: number,
  title: string,
  accentColor: number = V2Colors.Primary,
): { container: ContainerBuilder; totalPages: number } {
  const totalPages = Math.ceil(items.length / perPage);
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const start = (currentPage - 1) * perPage;
  const pageItems = items.slice(start, start + perPage);

  const container = new ContainerBuilder().setAccentColor(accentColor);
  addText(container, `### ${title}`);
  addSeparator(container, 'small');
  addText(container, pageItems.join('\n') || 'No items to display.');
  addFooter(container, `Page ${currentPage}/${totalPages} · ${items.length} total`);

  return { container, totalPages };
}

/* ─────────────────────────────────────────────
 * Moderation Action Container (replace modActionEmbed)
 * ───────────────────────────────────────────── */

export function modActionContainer(params: {
  action: string;
  targetTag: string;
  targetId: string;
  targetAvatarUrl: string;
  moderatorTag: string;
  reason: string;
  caseNumber: number;
  duration?: string;
  dmSent?: boolean;
  extraFields?: Array<{ name: string; value: string; inline?: boolean }>;
}): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(V2Colors.Moderation);

  // Title with thumbnail
  addSectionWithThumbnail(
    container,
    `### ${params.action} — Case #${params.caseNumber}`,
    params.targetAvatarUrl,
  );

  addSeparator(container, 'small');

  // Fields
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: 'User', value: `${params.targetTag} (${params.targetId})`, inline: true },
    { name: 'Moderator', value: params.moderatorTag, inline: true },
    { name: 'Reason', value: params.reason },
  ];

  if (params.duration) {
    fields.push({ name: 'Duration', value: params.duration, inline: true });
  }

  if (params.extraFields) {
    fields.push(...params.extraFields);
  }

  addFields(container, fields);

  if (params.dmSent !== undefined) {
    addFooter(container, params.dmSent ? 'DM sent to user' : 'Could not DM user');
  }

  return container;
}

/* ─────────────────────────────────────────────
 * Balance Container (replace balanceEmbed)
 * ───────────────────────────────────────────── */

export function balanceContainer(params: {
  username: string;
  avatarUrl: string;
  fields: Array<{ emoji: string; name: string; value: string }>;
  streak?: number;
  footerText?: string;
}): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(V2Colors.Economy);

  addSectionWithThumbnail(
    container,
    `### ${params.username}'s Balance`,
    params.avatarUrl,
  );

  addSeparator(container, 'small');

  const lines = params.fields.map(f => `${f.emoji} **${f.name}:** ${f.value}`);
  if (params.streak && params.streak > 0) {
    lines.push(`🔥 **Streak:** ${params.streak} day${params.streak !== 1 ? 's' : ''}`);
  }
  addText(container, lines.join('\n'));

  if (params.footerText) {
    addFooter(container, params.footerText);
  }

  return container;
}

/* ─────────────────────────────────────────────
 * Navigation Buttons (reusable)
 * ───────────────────────────────────────────── */

export function v2BackButton(customId = 'back'): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel('← Back')
    .setStyle(ButtonStyle.Secondary);
}

export function v2PaginationButtons(
  currentPage: number,
  totalPages: number,
  prefix: string,
): ButtonBuilder[] {
  return [
    new ButtonBuilder()
      .setCustomId(`${prefix}:prev`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}:page`)
      .setLabel(`${currentPage + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${prefix}:next`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1),
  ];
}

/* ─────────────────────────────────────────────
 * Quick Reply Helpers
 * ───────────────────────────────────────────── */

/**
 * Build a quick success reply payload.
 */
export function successReply(title?: string, description?: string) {
  return v2Payload([successContainer(title, description)]);
}

/**
 * Build a quick error reply payload.
 */
export function errorReply(title?: string, description?: string) {
  return v2Payload([errorContainer(title, description)]);
}

/**
 * Build a quick warning reply payload.
 */
export function warningReply(title: string, description?: string) {
  return v2Payload([warningContainer(title, description)]);
}

/**
 * Build a quick info reply payload.
 */
export function infoReply(title: string, description?: string) {
  return v2Payload([infoContainer(title, description)]);
}
