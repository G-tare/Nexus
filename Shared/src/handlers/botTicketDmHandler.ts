/**
 * Bot Ticket DM Handler
 *
 * Each ticket is represented by a SINGLE DM message with an embed that shows
 * the conversation transcript, paginated across multiple "pages."
 *
 * Users reply via a "Reply" button → modal flow. The button carries the ticket ID
 * in its customId, guaranteeing correct routing even with many open tickets.
 *
 * Users can attach images/videos via the "Attach" button → DM message collector.
 *
 * Messages are paginated with ◀ Previous / Next ▶ buttons. Each page shows
 * up to MESSAGES_PER_PAGE messages. New messages always jump to the last page.
 * No messages are ever trimmed — users can browse the full history.
 *
 * When a ticket is closed, the embed is edited to show "Closed" and the
 * Reply/page buttons are removed.
 *
 * Cross-process communication uses Redis lists (RPUSH / LPOP).
 */

import {
  Client,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonInteraction,
  ModalSubmitInteraction,
  ChannelType,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MessageFlags,
} from 'discord.js';
import { getPool } from '../database/connection';
import { cache } from '../cache/cacheManager';
import { ticketQueue } from '../queue/ticketQueueManager';
import { socketManager } from '../websocket/socketManager';
import { createModuleLogger } from '../utils/logger';
import { v2Payload, errorReply, infoReply, addText, addSeparator, addMediaGallery, addFooter, addButtons } from '../utils/componentsV2';

const logger = createModuleLogger('TicketDM');

// ── Types ──

interface AttachmentInfo {
  url: string;
  filename: string;
  contentType: string | null;
}

interface TranscriptMessage {
  author_type: 'user' | 'staff';
  author_name: string;
  message: string;
  created_at: string;
  attachments: AttachmentInfo[];
}

// ── Constants ──

const DM_QUEUE_KEY = 'botticket:dm_queue';
const CLOSE_QUEUE_KEY = 'botticket:close_queue';
const ATTACH_QUEUE_KEY = 'botticket:attach_queue';
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW = 60 * 10; // 10 minutes
const MAX_MESSAGE_LENGTH = 500; // Hard limit for user messages
const MESSAGES_PER_PAGE = 5; // Messages shown per embed page
const ATTACH_TIMEOUT_MS = 60_000; // 60 seconds to send an attachment
const MAX_ATTACHMENTS = 4; // Max files per message

// ── In-memory state ──

const pendingAttachments = new Map<string, { ticketId: number; expiresAt: number }>();

// Track notification messages so we can delete them when the user replies
// Key: `${userId}:${ticketId}` → Discord message ID of the notification
const notificationMessages = new Map<string, string>();

// ── Redis key helpers ──

function rateLimitKey(userId: string): string {
  return `botticket:ratelimit:${userId}`;
}

// ── Publish helpers (called from API process) ──

export async function publishStaffReply(data: {
  ticketId: number;
  userId: string;
  staffName: string;
  message: string;
  attachments?: AttachmentInfo[];
}): Promise<void> {
  await ticketQueue.enqueueDm(data);
  logger.info('Dispatched staff reply DM', { ticketId: data.ticketId, userId: data.userId });
}

export async function publishTicketClose(data: {
  ticketId: number;
  userId: string;
  closedBy: string;
  reason: string | null;
}): Promise<void> {
  await ticketQueue.enqueueClose(data);
}

/**
 * Publish a staff attachment to be sent via bot DM.
 * The API encodes the file as base64 and pushes it here.
 * The bot decodes, sends as Discord attachment, and stores the CDN URL.
 */
export async function publishStaffAttachment(data: {
  ticketId: number;
  userId: string;
  staffId: string;
  staffName: string;
  filename: string;
  base64Data: string;
  contentType: string;
}): Promise<void> {
  await ticketQueue.enqueueAttach(data);
  logger.info('Dispatched staff attachment DM', { ticketId: data.ticketId, filename: data.filename });
}

// ── Rate limiting ──

async function checkRateLimit(userId: string): Promise<boolean> {
  const key = rateLimitKey(userId);
  const current = cache.get<number>(key);

  if (current !== null && current >= RATE_LIMIT_MAX) {
    return false;
  }

  cache.incr(key);
  cache.expire(key, RATE_LIMIT_WINDOW);
  return true;
}

/**
 * Reset a user's rate limit counter.
 * Called when staff replies so the conversation can keep flowing.
 */
async function resetRateLimit(userId: string): Promise<void> {
  cache.del(rateLimitKey(userId));
}

/**
 * Check if a user is banned from using the ticket system.
 */
async function isTicketBanned(userId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT 1 FROM bot_ticket_bans WHERE user_id = $1',
    [userId],
  );
  return result.rows.length > 0;
}

// ── Conversation transcript builder (paginated) ──

/**
 * Build the conversation transcript string for ONE page of the embed.
 * Returns the page text plus total page count.
 */
function buildTranscriptPage(
  messages: TranscriptMessage[],
  headerText: string,
  page: number,
): { text: string; totalPages: number; currentPage: number } {
  const totalPages = Math.max(1, Math.ceil(messages.length / MESSAGES_PER_PAGE));
  // Clamp page to valid range
  const currentPage = Math.max(1, Math.min(page, totalPages));

  const start = (currentPage - 1) * MESSAGES_PER_PAGE;
  const end = start + MESSAGES_PER_PAGE;
  const pageMessages = messages.slice(start, end);

  const lines: string[] = [];
  for (const msg of pageMessages) {
    const label = msg.author_type === 'staff' ? '**Staff**' : '**You**';
    const time = formatTime(msg.created_at);
    let line = `${label} · ${time}\n${msg.message}`;

    // Render attachments as links
    const attachments: AttachmentInfo[] = Array.isArray(msg.attachments) ? msg.attachments : [];
    if (attachments.length > 0) {
      const attachLinks = attachments.map((a) => `📎 [${a.filename}](${a.url})`).join('\n');
      line += '\n' + attachLinks;
    }

    lines.push(line);
  }

  const transcript = lines.join('\n\n');
  const pageIndicator = totalPages > 1
    ? `\n\n*Page ${currentPage} of ${totalPages}*`
    : '';

  return {
    text: headerText + '\n\n' + transcript + pageIndicator,
    totalPages,
    currentPage,
  };
}

function formatTime(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return 'just now';
  // Use Discord's short date-time format (e.g. "March 2, 2026 7:42 PM")
  return `<t:${Math.floor(d.getTime() / 1000)}:f>`;
}

// ── Build / update the ticket DM embed ──

/**
 * Fetch all messages for a ticket and build the V2 container + button rows.
 * Supports pagination — pass `page` to control which page is shown.
 * Pass page = -1 (or omit) to show the LAST page (most recent messages).
 */
async function buildTicketEmbed(
  ticketId: number,
  status: 'open' | 'claimed' | 'closed',
  closedReason?: string | null,
  page?: number,
) {
  const pool = getPool();

  const ticketRow = await pool.query(
    'SELECT category, subcategory, subject, message AS original_message, user_id, closed_by FROM bot_tickets WHERE id = $1',
    [ticketId],
  );

  if (!ticketRow.rows[0]) return null;

  const { category, subcategory, subject, original_message: originalMsg, user_id: ticketUserId, closed_by: closedBy } = ticketRow.rows[0];

  const categoryLabel = subcategory
    ? `${capitalize(category)} — ${subcategory.replace(/_/g, ' ')}`
    : capitalize(category);

  const headerText =
    `**Category:** ${categoryLabel}\n` +
    `**Your message:** ${truncate(originalMsg, 300)}`;

  // Fetch conversation messages (including attachments)
  // Cast created_at to timestamptz to ensure pg driver interprets it as UTC
  const msgsResult = await pool.query(
    `SELECT author_type, author_name, message, created_at AT TIME ZONE 'UTC' AS created_at, attachments
     FROM bot_ticket_messages
     WHERE ticket_id = $1
     ORDER BY created_at ASC`,
    [ticketId],
  );

  const messages: TranscriptMessage[] = msgsResult.rows;

  // Default to last page (most recent messages) when page is -1, undefined, or 0
  const requestedPage = (!page || page < 1)
    ? Math.max(1, Math.ceil(messages.length / MESSAGES_PER_PAGE))
    : page;

  const { text: description, totalPages, currentPage } = buildTranscriptPage(
    messages,
    headerText,
    requestedPage,
  );

  const isClosed = status === 'closed';

  const color = isClosed ? 0xE74C3C : 0x5865F2;
  const title = isClosed
    ? `🔒 Ticket #${ticketId} — ${subject} (Closed)`
    : `📋 Ticket #${ticketId} — ${subject}`;

  const container = new ContainerBuilder().setAccentColor(color);
  addText(container, `### ${title}`);
  addText(container, description);

  // Collect ALL image attachments across all messages
  const allImages: { url: string; filename: string }[] = [];
  for (const msg of messages) {
    const attachments: AttachmentInfo[] = Array.isArray(msg.attachments) ? msg.attachments : [];
    for (const a of attachments) {
      if (
        a.contentType?.startsWith('image/') ||
        /\.(png|jpg|jpeg|gif|webp)$/i.test(a.filename)
      ) {
        allImages.push({ url: a.url, filename: a.filename });
      }
    }
  }

  // Show ALL images in a single full-size media gallery (no pagination needed)
  const totalImages = allImages.length;
  if (totalImages > 0) {
    addText(container, `🖼 ${totalImages} image${totalImages > 1 ? 's' : ''}`);
    addMediaGallery(
      container,
      allImages.map((img) => ({ url: img.url, description: img.filename })),
    );
  }

  addSeparator(container, 'small');

  if (isClosed) {
    const footerText = closedReason
      ? `Ticket #${ticketId} · Closed · Reason: ${closedReason}`
      : `Ticket #${ticketId} · Closed · Use /help to open a new ticket`;
    addFooter(container, footerText);
  } else {
    addFooter(container, `Ticket #${ticketId} · Reply or Attach files below`);
  }

  // Build action rows INSIDE the container (V2 requires action rows nested in containers)
  if (!isClosed) {
    const navButtons: ButtonBuilder[] = [];

    // ◀ Previous button (disabled on first page)
    if (totalPages > 1) {
      navButtons.push(
        new ButtonBuilder()
          .setCustomId(`botticket:page:${ticketId}:${currentPage - 1}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage <= 1),
      );
    }

    // Reply button
    navButtons.push(
      new ButtonBuilder()
        .setCustomId(`botticket:reply:${ticketId}`)
        .setLabel('Reply')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💬'),
    );

    // Attach button
    navButtons.push(
      new ButtonBuilder()
        .setCustomId(`botticket:attach:${ticketId}`)
        .setLabel('Attach')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📎'),
    );

    // Close button
    navButtons.push(
      new ButtonBuilder()
        .setCustomId(`botticket:close:${ticketId}`)
        .setLabel('Close')
        .setStyle(ButtonStyle.Danger),
    );

    // Next ▶ button (disabled on last page)
    if (totalPages > 1) {
      navButtons.push(
        new ButtonBuilder()
          .setCustomId(`botticket:page:${ticketId}:${currentPage + 1}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage >= totalPages),
      );
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(...navButtons);
    container.addActionRowComponents(row);
  } else {
    // Closed ticket — show Reopen button only if user closed it themselves
    const userClosedIt = closedBy === ticketUserId;
    if (userClosedIt) {
      const reopenRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`botticket:reopen:${ticketId}`)
          .setLabel('Reopen Ticket')
          .setStyle(ButtonStyle.Success),
      );
      container.addActionRowComponents(reopenRow);
    }
  }

  return { container, currentPage, totalPages };
}

/**
 * Send or update the ticket DM for a user.
 * If dm_thread_id (repurposed as dm_message_id) exists, edit the message.
 * Otherwise, send a new one and store its ID.
 */
export async function sendOrUpdateTicketDm(
  client: Client<true>,
  ticketId: number,
  userId: string,
  status: 'open' | 'claimed' | 'closed',
  closedReason?: string | null,
): Promise<void> {
  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) {
      logger.warn('Cannot fetch user for DM', { ticketId, userId });
      return;
    }

    const pool = getPool();

    // Get the existing DM message ID (stored in dm_thread_id column)
    const ticketRow = await pool.query(
      'SELECT dm_thread_id FROM bot_tickets WHERE id = $1',
      [ticketId],
    );

    const existingDmId = ticketRow.rows[0]?.dm_thread_id;

    const built = await buildTicketEmbed(ticketId, status, closedReason);
    if (!built) return;

    const { container } = built;
    // All action rows are now inside the container, so v2Payload is the complete message
    const payload = v2Payload([container]);

    if (existingDmId) {
      // Try to edit the existing DM
      try {
        const dmChannel = await user.createDM();
        const existingMsg = await dmChannel.messages.fetch(existingDmId).catch(() => null);
        if (existingMsg) {
          await existingMsg.edit(payload);
          logger.info('Edited ticket DM container', { ticketId, userId, dmMessageId: existingDmId });
          return;
        }
      } catch (err: any) {
        logger.warn('Failed to edit existing DM, sending new one', { ticketId, error: err.message });
      }
    }

    // Send a new DM
    const dm = await user.send(payload).catch((err) => {
      logger.warn('Failed to DM user', { ticketId, userId, error: err.message });
      return null;
    });

    if (!dm) return;

    // Store the DM message ID (using dm_thread_id column)
    await pool.query(
      'UPDATE bot_tickets SET dm_thread_id = $1 WHERE id = $2',
      [dm.id, ticketId],
    );

    logger.info('Sent new ticket DM container', { ticketId, userId, dmMessageId: dm.id });
  } catch (err: any) {
    logger.error('Error sending/updating ticket DM', { ticketId, userId, error: err.message });
  }
}

/**
 * Send a notification DM alerting the user there's a new response on their ticket.
 * This message will be auto-deleted when the user next replies.
 */
async function sendNotificationDm(
  client: Client<true>,
  ticketId: number,
  userId: string,
): Promise<void> {
  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return;

    const notif = await user.send(
      infoReply(`🔔 New response on Ticket #${ticketId}!`, 'Scroll up to view and reply.')
    ).catch(() => null);

    if (notif) {
      const key = `${userId}:${ticketId}`;
      // Delete any previous notification for this ticket first
      const prev = notificationMessages.get(key);
      if (prev) {
        try {
          const dmChannel = await user.createDM();
          const prevMsg = await dmChannel.messages.fetch(prev).catch(() => null);
          if (prevMsg) await prevMsg.delete().catch(() => null);
        } catch { /* ignore */ }
      }
      notificationMessages.set(key, notif.id);
    }
  } catch { /* ignore notification failures */ }
}

/**
 * Delete the notification message for a ticket when the user replies.
 */
async function deleteNotificationDm(
  client: Client<true>,
  userId: string,
  ticketId: number,
): Promise<void> {
  const key = `${userId}:${ticketId}`;
  const msgId = notificationMessages.get(key);
  if (!msgId) return;

  notificationMessages.delete(key);

  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return;
    const dmChannel = await user.createDM();
    const msg = await dmChannel.messages.fetch(msgId).catch(() => null);
    if (msg) await msg.delete().catch(() => null);
  } catch { /* ignore */ }
}

// ── Helpers ──

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + '...';
}

// ── Main registration ──

export async function registerTicketDmListener(client: Client<true>): Promise<void> {
  // ── Handle "Reply" button clicks ──
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('botticket:reply:')) return;

    const buttonInteraction = interaction as ButtonInteraction;
    const ticketId = parseInt(interaction.customId.split(':')[2], 10);
    if (isNaN(ticketId)) return;

    // Ban check
    if (await isTicketBanned(buttonInteraction.user.id)) {
      await buttonInteraction.reply(
        { ...errorReply('Banned', 'You have been banned from the ticket system.'), ephemeral: true }
      ).catch(() => null);
      return;
    }

    // Show modal for user to type their reply
    const modal = new ModalBuilder()
      .setCustomId(`botticket:modal:${ticketId}`)
      .setTitle(`Reply to Ticket #${ticketId}`)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('ticket_reply_text')
            .setLabel(`Your reply (max ${MAX_MESSAGE_LENGTH} chars)`)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(`Type your response here... (max ${MAX_MESSAGE_LENGTH} characters, 3 messages every 10 minutes)`)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(MAX_MESSAGE_LENGTH),
        ),
      );

    await buttonInteraction.showModal(modal).catch((err) => {
      logger.error('Failed to show ticket reply modal', { ticketId, error: err.message });
    });
  });

  // ── Handle modal submissions ──
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('botticket:modal:')) return;

    const modalInteraction = interaction as ModalSubmitInteraction;
    const ticketId = parseInt(interaction.customId.split(':')[2], 10);
    if (isNaN(ticketId)) return;

    const replyText = modalInteraction.fields.getTextInputValue('ticket_reply_text').trim();
    if (!replyText) {
      await modalInteraction.reply({ content: 'Reply cannot be empty.', ephemeral: true }).catch(() => null);
      return;
    }

    const userId = modalInteraction.user.id;

    // Ban check
    if (await isTicketBanned(userId)) {
      await modalInteraction.reply(
        { ...errorReply('Banned', 'You have been banned from the ticket system.'), ephemeral: true }
      ).catch(() => null);
      return;
    }

    // Verify ticket is still open
    const pool = getPool();
    const ticketCheck = await pool.query(
      'SELECT status FROM bot_tickets WHERE id = $1',
      [ticketId],
    );

    if (!ticketCheck.rows[0] || ticketCheck.rows[0].status === 'closed') {
      await modalInteraction.reply(
        { ...errorReply('Closed', 'This ticket has been closed. Use `/help` to open a new one.'), ephemeral: true }
      ).catch(() => null);
      return;
    }

    // Rate limit
    const withinLimit = await checkRateLimit(userId);
    if (!withinLimit) {
      await modalInteraction.reply(
        { ...errorReply('Rate Limited', 'You\'re sending messages too quickly. Please wait a few minutes.'), ephemeral: true }
      ).catch(() => null);
      return;
    }

    // Insert message (enforce max length)
    const content = replyText.slice(0, MAX_MESSAGE_LENGTH);

    await pool.query(
      `INSERT INTO bot_ticket_messages (ticket_id, author_type, author_id, author_name, message, attachments)
       VALUES ($1, 'user', $2, $3, $4, '[]'::jsonb)`,
      [ticketId, userId, modalInteraction.user.username, content],
    );

    await pool.query(
      'UPDATE bot_tickets SET updated_at = NOW() WHERE id = $1',
      [ticketId],
    );

    // Notify dashboard via WebSocket
    socketManager.broadcast('ticket:message', {
      ticketId,
      authorType: 'user',
      authorId: userId,
      authorName: modalInteraction.user.username,
      message: content,
      attachments: [],
    });

    // Acknowledge the modal
    await modalInteraction.deferUpdate().catch(() => null);

    // Delete the notification message (user is responding)
    await deleteNotificationDm(client, userId, ticketId);

    // Update the DM embed with the new message
    await sendOrUpdateTicketDm(client, ticketId, userId, ticketCheck.rows[0].status);

    logger.info('User replied to ticket via button/modal', { ticketId, userId });
  });

  // ── Handle "Attach" button clicks ──
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('botticket:attach:')) return;

    const buttonInteraction = interaction as ButtonInteraction;
    const ticketId = parseInt(interaction.customId.split(':')[2], 10);
    if (isNaN(ticketId)) return;

    const userId = buttonInteraction.user.id;

    // Ban check
    if (await isTicketBanned(userId)) {
      await buttonInteraction.reply(
        { ...errorReply('Banned', 'You have been banned from the ticket system.'), ephemeral: true }
      ).catch(() => null);
      return;
    }

    // Verify ticket is still open
    const pool = getPool();
    const ticketCheck = await pool.query(
      'SELECT status FROM bot_tickets WHERE id = $1',
      [ticketId],
    );

    if (!ticketCheck.rows[0] || ticketCheck.rows[0].status === 'closed') {
      await buttonInteraction.reply(
        { ...errorReply('Closed', 'This ticket is closed. You cannot send attachments.'), ephemeral: true }
      ).catch(() => null);
      return;
    }

    // Rate limit (attachments count as messages)
    const withinLimit = await checkRateLimit(userId);
    if (!withinLimit) {
      await buttonInteraction.reply(
        { ...errorReply('Rate Limited', 'You\'re sending messages too quickly. Please wait a few minutes.'), ephemeral: true }
      ).catch(() => null);
      return;
    }

    // Store pending attachment state
    pendingAttachments.set(userId, {
      ticketId,
      expiresAt: Date.now() + ATTACH_TIMEOUT_MS,
    });

    // Prompt the user to send their file
    await buttonInteraction.reply(
      { ...infoReply('📎 Send Attachment',
        `Send your image or video as a regular message in this DM within 60 seconds.\n\nYou can attach up to ${MAX_ATTACHMENTS} files. Supported: images, videos, PDFs, and other files.\n\nThis prompt will expire in 60 seconds.`),
        ephemeral: true }
    ).catch(() => null);

    logger.info('User initiated attachment flow', { ticketId, userId });
  });

  // ── Handle DM messages with attachments ──
  client.on(Events.MessageCreate, async (message) => {
    // Only handle DMs from non-bots
    if (message.author.bot) return;
    if (message.channel.type !== ChannelType.DM) return;

    const userId = message.author.id;
    const pending = pendingAttachments.get(userId);

    // No pending attachment for this user
    if (!pending) return;

    // Ban check
    if (await isTicketBanned(userId)) {
      pendingAttachments.delete(userId);
      await message.reply(
        errorReply('Banned', 'You have been banned from the ticket system.')
      ).catch(() => null);
      return;
    }

    // Expired
    if (Date.now() > pending.expiresAt) {
      pendingAttachments.delete(userId);
      return;
    }

    // Must have at least one attachment
    if (message.attachments.size === 0) {
      await message.reply(
        errorReply('No Attachments', 'Please send an image, video, or file.')
      ).catch(() => null);
      return;
    }

    // Clear pending state
    pendingAttachments.delete(userId);

    const { ticketId } = pending;
    const pool = getPool();

    // Verify ticket is still open
    const ticketCheck = await pool.query(
      'SELECT status FROM bot_tickets WHERE id = $1',
      [ticketId],
    );

    if (!ticketCheck.rows[0] || ticketCheck.rows[0].status === 'closed') {
      await message.reply({ content: 'This ticket has been closed.' }).catch(() => null);
      return;
    }

    // Collect attachment info (Discord CDN URLs persist)
    const attachments: AttachmentInfo[] = [];
    let count = 0;
    for (const [, attach] of message.attachments) {
      if (count >= MAX_ATTACHMENTS) break;
      attachments.push({
        url: attach.url,
        filename: attach.name ?? 'file',
        contentType: attach.contentType,
      });
      count++;
    }

    // Optional text content from the message
    const textContent = message.content?.trim().slice(0, MAX_MESSAGE_LENGTH) || '(attachment)';

    // Insert message with attachments
    await pool.query(
      `INSERT INTO bot_ticket_messages (ticket_id, author_type, author_id, author_name, message, attachments)
       VALUES ($1, 'user', $2, $3, $4, $5::jsonb)`,
      [ticketId, userId, message.author.username, textContent, JSON.stringify(attachments)],
    );

    await pool.query(
      'UPDATE bot_tickets SET updated_at = NOW() WHERE id = $1',
      [ticketId],
    );

    // Notify dashboard via WebSocket
    socketManager.broadcast('ticket:message', {
      ticketId,
      authorType: 'user',
      authorId: userId,
      authorName: message.author.username,
      message: textContent,
      attachments,
    });

    // Delete the user's raw attachment message — it's now part of the embed
    await message.delete().catch(() => null);

    // Delete notification message (user is responding)
    await deleteNotificationDm(client, userId, ticketId);

    // Update the DM embed — shows the image inline via setImage
    await sendOrUpdateTicketDm(client, ticketId, userId, ticketCheck.rows[0].status);

    logger.info('User attached files to ticket', { ticketId, userId, fileCount: attachments.length });
  });

  // ── Handle page navigation button clicks ──
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('botticket:page:')) return;

    const buttonInteraction = interaction as ButtonInteraction;
    // customId format: botticket:page:{ticketId}:{pageNum}
    const parts = interaction.customId.split(':');
    const ticketId = parseInt(parts[2], 10);
    const requestedPage = parseInt(parts[3], 10);
    if (isNaN(ticketId) || isNaN(requestedPage)) return;

    try {
      const pool = getPool();
      const ticketRow = await pool.query(
        'SELECT status, user_id FROM bot_tickets WHERE id = $1',
        [ticketId],
      );

      if (!ticketRow.rows[0]) {
        await buttonInteraction.deferUpdate().catch(() => null);
        return;
      }

      const { status } = ticketRow.rows[0];

      const built = await buildTicketEmbed(ticketId, status, null, requestedPage);
      if (!built) {
        await buttonInteraction.deferUpdate().catch(() => null);
        return;
      }

      await buttonInteraction.update(v2Payload([built.container])).catch(() => null);
    } catch (err: any) {
      logger.error('Failed to handle page navigation', { ticketId, page: requestedPage, error: err.message });
      await buttonInteraction.deferUpdate().catch(() => null);
    }
  });

  // ── Handle "Close" button clicks (user closing their own ticket) ──
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('botticket:close:')) return;

    const buttonInteraction = interaction as ButtonInteraction;
    const ticketId = parseInt(interaction.customId.split(':')[2], 10);
    if (isNaN(ticketId)) return;

    const userId = buttonInteraction.user.id;

    // Ban check — banned users can't close tickets either (staff handles it)
    if (await isTicketBanned(userId)) {
      await buttonInteraction.reply(
        { ...errorReply('Banned', 'You have been banned from the ticket system.'), ephemeral: true }
      ).catch(() => null);
      return;
    }

    try {
      const pool = getPool();

      // Verify ticket belongs to this user and is not already closed
      const ticketRow = await pool.query(
        'SELECT status, user_id FROM bot_tickets WHERE id = $1',
        [ticketId],
      );

      if (!ticketRow.rows[0] || ticketRow.rows[0].user_id !== userId) {
        await buttonInteraction.deferUpdate().catch(() => null);
        return;
      }

      if (ticketRow.rows[0].status === 'closed') {
        await buttonInteraction.reply({
          content: 'This ticket is already closed.',
          ephemeral: true,
        }).catch(() => null);
        return;
      }

      // Close the ticket (closed_by = userId, so it's a user close)
      await pool.query(
        `UPDATE bot_tickets
         SET status = 'closed', closed_by = $1, closed_reason = 'Closed by user', closed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [userId, ticketId],
      );

      // Insert system message
      await pool.query(
        `INSERT INTO bot_ticket_messages (ticket_id, author_type, author_id, author_name, message, attachments)
         VALUES ($1, 'user', $2, $3, 'Ticket closed by user.', '[]'::jsonb)`,
        [ticketId, userId, buttonInteraction.user.username],
      );

      // Broadcast to dashboard
      socketManager.broadcast('ticket:closed', {
        ticketId,
        closedBy: userId,
        reason: 'Closed by user',
      });

      await buttonInteraction.deferUpdate().catch(() => null);

      // Update the embed to show closed state (with reopen button since user closed it)
      await sendOrUpdateTicketDm(client, ticketId, userId, 'closed', 'Closed by user');

      logger.info('User closed their ticket', { ticketId, userId });
    } catch (err: any) {
      logger.error('Failed to handle user ticket close', { ticketId, error: err.message });
      await buttonInteraction.deferUpdate().catch(() => null);
    }
  });

  // ── Handle "Reopen" button clicks ──
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('botticket:reopen:')) return;

    const buttonInteraction = interaction as ButtonInteraction;
    const ticketId = parseInt(interaction.customId.split(':')[2], 10);
    if (isNaN(ticketId)) return;

    const userId = buttonInteraction.user.id;

    // Ban check
    if (await isTicketBanned(userId)) {
      await buttonInteraction.reply(
        { ...errorReply('Banned', 'You have been banned from the ticket system.'), ephemeral: true }
      ).catch(() => null);
      return;
    }

    try {
      const pool = getPool();

      // Verify ticket is closed by the user (not by staff)
      const ticketRow = await pool.query(
        'SELECT status, user_id, closed_by FROM bot_tickets WHERE id = $1',
        [ticketId],
      );

      if (!ticketRow.rows[0]) {
        await buttonInteraction.deferUpdate().catch(() => null);
        return;
      }

      const { status, user_id: ticketUserId, closed_by: closedBy } = ticketRow.rows[0];

      if (status !== 'closed') {
        await buttonInteraction.reply(
          { ...infoReply('Already Open', 'This ticket is already open.'), ephemeral: true }
        ).catch(() => null);
        return;
      }

      // Only allow reopen if the user closed it themselves
      if (closedBy !== ticketUserId) {
        await buttonInteraction.reply(
          { ...errorReply('Cannot Reopen', 'This ticket was closed by staff and cannot be reopened. Use /help to open a new ticket.'), ephemeral: true }
        ).catch(() => null);
        return;
      }

      // Only the ticket owner can reopen via DM
      if (userId !== ticketUserId) {
        await buttonInteraction.deferUpdate().catch(() => null);
        return;
      }

      // Reopen the ticket
      await pool.query(
        `UPDATE bot_tickets
         SET status = 'open', closed_by = NULL, closed_reason = NULL, closed_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [ticketId],
      );

      // Insert system message
      await pool.query(
        `INSERT INTO bot_ticket_messages (ticket_id, author_type, author_id, author_name, message, attachments)
         VALUES ($1, 'user', $2, $3, 'Ticket reopened.', '[]'::jsonb)`,
        [ticketId, userId, buttonInteraction.user.username],
      );

      // Broadcast to dashboard
      socketManager.broadcast('ticket:reopened', {
        ticketId,
        reopenedBy: userId,
      });

      await buttonInteraction.deferUpdate().catch(() => null);

      // Update the embed to show open state
      await sendOrUpdateTicketDm(client, ticketId, userId, 'open');

      logger.info('User reopened their ticket', { ticketId, userId });
    } catch (err: any) {
      logger.error('Failed to handle ticket reopen', { ticketId, error: err.message });
      await buttonInteraction.deferUpdate().catch(() => null);
    }
  });

  // ── Register direct handlers via TicketQueueManager ──
  // Replaces the Redis LPOP polling loops (was ~2.6M commands/month)
  // Now: zero Redis commands, instant delivery via direct function calls

  ticketQueue.registerDmHandler(async (data) => {
    try {
      logger.info('Processing staff reply DM', { ticketId: data.ticketId, userId: data.userId });

      // Staff replied — reset the user's rate limit so they can respond
      await resetRateLimit(data.userId);

      // The staff message was already inserted by the API route.
      // We just need to update/send the DM embed.
      const pool = getPool();
      const ticketRow = await pool.query(
        'SELECT status FROM bot_tickets WHERE id = $1',
        [data.ticketId],
      );
      const status = ticketRow.rows[0]?.status || 'open';
      await sendOrUpdateTicketDm(client, data.ticketId, data.userId, status);

      // Send a notification DM so the user gets a Discord notification
      await sendNotificationDm(client, data.ticketId, data.userId);

      // Update dm_message_id on the staff message row
      const ticketAfter = await pool.query(
        'SELECT dm_thread_id FROM bot_tickets WHERE id = $1',
        [data.ticketId],
      );
      const dmMsgId = ticketAfter.rows[0]?.dm_thread_id;
      if (dmMsgId) {
        await pool.query(
          `UPDATE bot_ticket_messages
           SET dm_message_id = $1
           WHERE id = (
             SELECT id FROM bot_ticket_messages
             WHERE ticket_id = $2 AND author_type = 'staff' AND dm_message_id IS NULL
             ORDER BY created_at DESC LIMIT 1
           )`,
          [dmMsgId, data.ticketId],
        );
      }
    } catch (err: any) {
      logger.error('Failed to process staff reply DM', { ticketId: data.ticketId, error: err.message });
    }
  });

  ticketQueue.registerCloseHandler(async (data) => {
    try {
      await sendOrUpdateTicketDm(client, data.ticketId, data.userId, 'closed', data.reason);
    } catch (err: any) {
      logger.error('Failed to process ticket close DM', { ticketId: data.ticketId, error: err.message });
    }
  });

  ticketQueue.registerAttachHandler(async (data) => {
    try {
      // Decode base64 and send as a Discord attachment
      const user = await client.users.fetch(data.userId).catch(() => null);
      if (!user) {
        logger.warn('Cannot fetch user for staff attachment', { ticketId: data.ticketId });
        return;
      }

      const buffer = Buffer.from(data.base64Data, 'base64');
      const { AttachmentBuilder } = await import('discord.js');
      const discordAttachment = new AttachmentBuilder(buffer, { name: data.filename });

      // Send the file as a temporary DM just to get the Discord CDN URL,
      // then immediately delete it — the image will be shown in the ticket embed instead.
      const sentMsg = await user.send({
        files: [discordAttachment],
      }).catch((err) => {
        logger.warn('Failed to send staff attachment DM', { error: err.message });
        return null;
      });

      if (sentMsg && sentMsg.attachments.size > 0) {
        // Grab the CDN URL, then delete the temporary message
        const sentAttach = sentMsg.attachments.first();
        const cdnUrl = sentAttach?.url ?? '';
        await sentMsg.delete().catch(() => null);

        const attachmentInfo: AttachmentInfo[] = [{
          url: cdnUrl,
          filename: data.filename,
          contentType: data.contentType,
        }];

        // Insert message in DB
        const pool = getPool();
        await pool.query(
          `INSERT INTO bot_ticket_messages (ticket_id, author_type, author_id, author_name, message, attachments)
           VALUES ($1, 'staff', $2, $3, '(attachment)', $4::jsonb)`,
          [data.ticketId, data.staffId, data.staffName, JSON.stringify(attachmentInfo)],
        );

        await pool.query(
          'UPDATE bot_tickets SET updated_at = NOW() WHERE id = $1',
          [data.ticketId],
        );

        // Broadcast to dashboard
        socketManager.broadcast('ticket:message', {
          ticketId: data.ticketId,
          authorType: 'staff',
          authorId: data.staffId,
          authorName: data.staffName,
          message: '(attachment)',
          attachments: attachmentInfo,
        });

        // Update the main ticket embed — image will appear via setImage
        const ticketRow = await pool.query(
          'SELECT status FROM bot_tickets WHERE id = $1',
          [data.ticketId],
        );
        const status = ticketRow.rows[0]?.status || 'open';
        await sendOrUpdateTicketDm(client, data.ticketId, data.userId, status);
      }
    } catch (err: any) {
      logger.error('Failed to process staff attachment DM', { ticketId: data.ticketId, error: err.message });
    }
  });

  logger.info('Ticket DM listener registered (direct handlers, no polling)');
}
