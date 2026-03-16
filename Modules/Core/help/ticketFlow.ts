/**
 * Ticket Flow — Multi-step ticket creation accessible from /help home.
 *
 * Flow:
 *  1. User clicks "Contact Support" on /help home
 *  2. Category select menu (Help, Appeal, Suggestion, Bug, Feedback)
 *  3. If Appeal: subcategory select (userphone server ban, voicephone server ban,
 *     userphone user ban, voicephone user ban, confessions ban, other)
 *  4. Modal: subject + message
 *  5. Confirmation container → ticket stored in DB, WebSocket broadcast
 *
 * Ban source detection:
 *  - Confessions bans are per-guild by server staff → auto-refuse, tell user to talk to server staff
 *  - Server-wide bans (userphone/voicephone server) → require ManageGuild permission
 *  - User bans (userphone/voicephone user) → check if banned by bot staff first
 */

import {
  ContainerBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageComponentInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { InteractiveSession, PageContent } from '../../../Shared/src/utils/interactiveEmbed';
import { getPool } from '../../../Shared/src/database/connection';
import { cache } from '../../../Shared/src/cache/cacheManager';
import { socketManager } from '../../../Shared/src/websocket/socketManager';
import { isServerBanned as isUserphoneServerBanned } from '../../Userphone/helpers';
import { isUserBanned as isUserphoneUserBanned } from '../../Userphone/helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { successContainer, errorContainer, addSeparator, addText, addFooter, addButtons, addSelectMenu, V2Colors } from '../../../Shared/src/utils/componentsV2';
import { sendOrUpdateTicketDm } from '../../../Shared/src/handlers/botTicketDmHandler';

const logger = createModuleLogger('TicketFlow');

// Lazy import voicephone helpers to avoid circular dependency issues
async function getVoicephoneHelpers(): Promise<{
  isServerBanned: (guildId: string) => Promise<boolean>;
  isUserBanned: (userId: string) => Promise<{ banned: boolean; permanent?: boolean; reason?: string; expiresAt?: number; banNumber?: number }>;
} | null> {
  try {
    const vp = await import('../../VoicePhone/helpers');
    return vp;
  } catch {
    logger.warn('VoicePhone helpers not available — voicephone appeal validation will be skipped');
    return null;
  }
}

/* ── Constants ── */

const TICKET_COLOR = V2Colors.Primary;  // Blurple for ticket containers
const SUCCESS_COLOR = V2Colors.Success; // Green for success
const ERROR_COLOR = V2Colors.Error;     // Red for errors

const CATEGORIES = [
  { label: 'Help / Question', description: 'Get help with a bot feature or command', value: 'help', emoji: '❓' },
  { label: 'Appeal', description: 'Appeal a ban or restriction', value: 'appeal', emoji: '⚖️' },
  { label: 'Suggestion', description: 'Suggest a new feature or improvement', value: 'suggestion', emoji: '💡' },
  { label: 'Bug Report', description: 'Report something that isn\'t working right', value: 'bug', emoji: '🐛' },
  { label: 'Feedback', description: 'General feedback about the bot', value: 'feedback', emoji: '💬' },
];

const APPEAL_SUBCATEGORIES = [
  { label: 'Userphone Server Ban', description: 'Your server was banned from userphone', value: 'userphone_server_ban', emoji: '📞' },
  { label: 'VoicePhone Server Ban', description: 'Your server was banned from voicephone', value: 'voicephone_server_ban', emoji: '☎️' },
  { label: 'Userphone User Ban', description: 'You were personally banned from userphone', value: 'userphone_user_ban', emoji: '🚫' },
  { label: 'VoicePhone User Ban', description: 'You were personally banned from voicephone', value: 'voicephone_user_ban', emoji: '🔇' },
  { label: 'Confessions Ban', description: 'You were banned from confessions', value: 'confessions_ban', emoji: '🤫' },
  { label: 'Other', description: 'Appeal something not listed above', value: 'other', emoji: '📋' },
];

/* ── Helper: check if user actually has the ban they're appealing ── */

async function validateAppealEligibility(
  userId: string,
  guildId: string | null,
  subcategory: string,
  hasManageGuild: boolean,
): Promise<{ eligible: boolean; reason?: string }> {
  switch (subcategory) {
    case 'userphone_server_ban': {
      if (!guildId) return { eligible: false, reason: 'Server appeals must be submitted from within a server.' };
      if (!hasManageGuild) return { eligible: false, reason: 'Only server administrators can appeal server-wide bans. You need **Manage Server** permission.' };
      const banned = await isUserphoneServerBanned(guildId);
      if (!banned) return { eligible: false, reason: 'This server is not currently banned from userphone.' };
      return { eligible: true };
    }

    case 'voicephone_server_ban': {
      if (!guildId) return { eligible: false, reason: 'Server appeals must be submitted from within a server.' };
      if (!hasManageGuild) return { eligible: false, reason: 'Only server administrators can appeal server-wide bans. You need **Manage Server** permission.' };
      const vp = await getVoicephoneHelpers();
      if (!vp) return { eligible: true }; // Skip validation if helpers unavailable
      const banned = await vp.isServerBanned(guildId);
      if (!banned) return { eligible: false, reason: 'This server is not currently banned from voicephone.' };
      return { eligible: true };
    }

    case 'userphone_user_ban': {
      const ban = await isUserphoneUserBanned(userId);
      if (!ban.banned) return { eligible: false, reason: 'You are not currently banned from userphone.' };
      // Check if ban was by bot staff (bannedBy is a bot owner/staff ID)
      // For user-level bans, they're always by bot staff so we allow appeal
      return { eligible: true };
    }

    case 'voicephone_user_ban': {
      const vp = await getVoicephoneHelpers();
      if (!vp) return { eligible: true }; // Skip validation if helpers unavailable
      const ban = await vp.isUserBanned(userId);
      if (!ban.banned) return { eligible: false, reason: 'You are not currently banned from voicephone.' };
      return { eligible: true };
    }

    case 'confessions_ban': {
      // Confessions bans are per-guild, managed by server staff — not bot staff
      return {
        eligible: false,
        reason: 'Confessions bans are managed by **server staff**, not by the bot team.\n\nPlease contact the staff of the server where you were banned. The bot team cannot lift server-level confessions bans.',
      };
    }

    case 'other':
      return { eligible: true };

    default:
      return { eligible: true };
  }
}

/* ── Build: category select page ── */

function buildCategoryPage(userId: string): PageContent {
  const container = new ContainerBuilder().setAccentColor(TICKET_COLOR);

  addText(
    container,
    '### 🎫 Contact Support\n\n' +
    'Select a category for your ticket below.\n\n' +
    'Our team will review your ticket and respond as soon as possible. ' +
    'You\'ll receive a DM when there\'s a reply.'
  );

  addSeparator(container, 'small');

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ticket:${userId}:category`)
    .setPlaceholder('📂 What do you need help with?')
    .addOptions(CATEGORIES);

  addSelectMenu(container, selectMenu);

  const backButton = new ButtonBuilder()
    .setCustomId(`ticket:${userId}:cancel`)
    .setLabel('← Back to Help')
    .setStyle(ButtonStyle.Secondary);

  addButtons(container, [backButton]);

  addFooter(container, 'Tickets are reviewed by bot staff · Response time varies');

  return { containers: [container] };
}

/* ── Build: appeal subcategory page ── */

function buildAppealSubcategoryPage(userId: string): PageContent {
  const container = new ContainerBuilder().setAccentColor(TICKET_COLOR);

  addText(
    container,
    '### ⚖️ Appeal — Select Type\n\n' +
    'What type of ban or restriction would you like to appeal?\n\n' +
    '**Note:** Server-wide ban appeals require **Manage Server** permission.\n' +
    'Confessions bans are managed by server staff — contact them directly.'
  );

  addSeparator(container, 'small');

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ticket:${userId}:appealtype`)
    .setPlaceholder('⚖️ Select appeal type…')
    .addOptions(APPEAL_SUBCATEGORIES);

  addSelectMenu(container, selectMenu);

  const backButton = new ButtonBuilder()
    .setCustomId(`ticket:${userId}:backcategory`)
    .setLabel('← Back')
    .setStyle(ButtonStyle.Secondary);

  addButtons(container, [backButton]);

  addFooter(container, 'Select the type of restriction you want to appeal');

  return { containers: [container] };
}

/* ── Build: error page ── */

function buildErrorPage(userId: string, message: string): PageContent {
  const container = errorContainer('Cannot Submit Appeal');

  addText(container, message);

  const backCategoryButton = new ButtonBuilder()
    .setCustomId(`ticket:${userId}:backcategory`)
    .setLabel('← Back to Categories')
    .setStyle(ButtonStyle.Secondary);

  const backHelpButton = new ButtonBuilder()
    .setCustomId(`ticket:${userId}:cancel`)
    .setLabel('Back to Help')
    .setStyle(ButtonStyle.Secondary);

  addButtons(container, [backCategoryButton, backHelpButton]);

  addFooter(container, 'You can try a different category or go back to help');

  return { containers: [container] };
}

/* ── Build: success page ── */

function buildSuccessPage(ticketNumber: number, category: string): PageContent {
  const categoryLabel = CATEGORIES.find(c => c.value === category)?.label ?? category;

  const container = successContainer('Ticket Submitted!');

  addText(
    container,
    `Your **${categoryLabel}** ticket has been submitted.\n\n` +
    `**Ticket #${ticketNumber}**\n\n` +
    'Our team will review your ticket as soon as possible.\n' +
    'You\'ll receive a **DM** when there\'s a reply — make sure your DMs are open!\n\n' +
    '*You can reply to the DM within 7 days to continue the conversation.*'
  );

  addFooter(container, `Ticket #${ticketNumber} · Thank you for reaching out!`);

  return { containers: [container] };
}

/* ── Ticket ban check ── */

async function isTicketBanned(userId: string): Promise<{ banned: boolean; reason?: string }> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT reason FROM bot_ticket_bans WHERE user_id = $1',
    [userId],
  );
  if (result.rows[0]) {
    return { banned: true, reason: result.rows[0].reason || 'You have been banned from creating tickets.' };
  }
  return { banned: false };
}

/* ── Rate limiting ── */

const TICKET_CREATE_LIMIT = 3; // max tickets per window
const TICKET_CREATE_WINDOW = 60 * 60; // 1 hour

/**
 * Check if the user can create a new ticket (max 3 per hour).
 * Also enforces max 5 open tickets at a time.
 */
async function checkTicketCreationLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const pool = getPool();

  // Check open ticket count
  const openResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM bot_tickets WHERE user_id = $1 AND status != 'closed'`,
    [userId],
  );
  if (openResult.rows[0].count >= 5) {
    return { allowed: false, reason: 'You already have 5 open tickets. Please wait for a response or close an existing ticket before creating a new one.' };
  }

  // Check rate limit via cache
  const key = `botticket:create_ratelimit:${userId}`;
  const current = cache.get<number>(key);
  if (current && current >= TICKET_CREATE_LIMIT) {
    return { allowed: false, reason: 'You\'ve created too many tickets recently. Please wait a while before creating another one.' };
  }

  // Increment (will be committed after ticket creation)
  const newCount = cache.incr(key, TICKET_CREATE_WINDOW);

  return { allowed: true };
}

/* ── Create ticket in DB ── */

async function createTicket(params: {
  guildId: string | null;
  userId: string;
  username: string;
  category: string;
  subcategory: string | null;
  subject: string;
  message: string;
}): Promise<number> {
  const pool = getPool();

  const result = await pool.query(
    `INSERT INTO bot_tickets (guild_id, user_id, username, category, subcategory, subject, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [params.guildId, params.userId, params.username, params.category, params.subcategory, params.subject, params.message],
  );

  const ticketId = result.rows[0].id;

  // Also insert the initial message as the first ticket message
  await pool.query(
    `INSERT INTO bot_ticket_messages (ticket_id, author_type, author_id, author_name, message)
     VALUES ($1, 'user', $2, $3, $4)`,
    [ticketId, params.userId, params.username, params.message],
  );

  return ticketId;
}

/* ── Main: handle ticket flow from /help ── */

/**
 * Run the ticket creation flow within an existing InteractiveSession.
 * Called when user clicks the "Contact Support" button on /help home.
 *
 * @returns true if the user wants to go back to help, false otherwise
 */
export async function runTicketFlow(
  session: InteractiveSession,
  interaction: MessageComponentInteraction,
): Promise<boolean> {
  const userId = session.userId;
  const guildId = interaction.guildId;

  // Check ManageGuild permission (needed for server-wide appeals)
  let hasManageGuild = false;
  if (interaction.memberPermissions) {
    hasManageGuild = interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild);
  }

  let selectedCategory: string | null = null;
  let selectedSubcategory: string | null = null;

  // Check if user is banned from tickets
  const banCheck = await isTicketBanned(userId);
  if (banCheck.banned) {
    await interaction.deferUpdate();
    await session.setPage(buildErrorPage(userId, `🚫 **You are banned from creating tickets.**\n\n${banCheck.reason}`));
    // Wait briefly then return
    await session.awaitComponent(10_000).catch(() => null);
    return true;
  }

  // Step 1: Show category selection
  await interaction.deferUpdate();
  await session.setPage(buildCategoryPage(userId));

  while (!session.isEnded) {
    const component = await session.awaitComponent(120_000);
    if (!component) return false;

    const cid = component.customId;

    /* ── Cancel: go back to help ── */
    if (cid === `ticket:${userId}:cancel`) {
      await component.deferUpdate();
      return true; // Caller will restore help home page
    }

    /* ── Back to category ── */
    if (cid === `ticket:${userId}:backcategory`) {
      await component.deferUpdate();
      selectedCategory = null;
      selectedSubcategory = null;
      await session.setPage(buildCategoryPage(userId));
      continue;
    }

    /* ── Category selected ── */
    if (cid === `ticket:${userId}:category` && component.isStringSelectMenu()) {
      selectedCategory = component.values[0];

      if (selectedCategory === 'appeal') {
        // Show appeal subcategory picker
        await component.deferUpdate();
        await session.setPage(buildAppealSubcategoryPage(userId));
        continue;
      }

      // Non-appeal categories go straight to modal
      const modalResult = await session.showModal(component, {
        title: `${CATEGORIES.find(c => c.value === selectedCategory)?.label ?? 'Ticket'}`,
        fieldId: 'ticket_message',
        label: 'Describe your issue (500 char limit)',
        placeholder: 'Please provide as much detail as possible… (500 characters max)',
        required: true,
        style: 'paragraph',
        minLength: 20,
        maxLength: 500,
      });

      if (!modalResult) continue; // Modal timed out

      // Rate limit check
      const rateCheck = await checkTicketCreationLimit(userId);
      if (!rateCheck.allowed) {
        await modalResult.modalInteraction.deferUpdate();
        await session.setPage(buildErrorPage(userId, rateCheck.reason!));
        continue;
      }

      // Create the ticket
      try {
        const ticketId = await createTicket({
          guildId,
          userId,
          username: interaction.user.username,
          category: selectedCategory,
          subcategory: null,
          subject: `${CATEGORIES.find(c => c.value === selectedCategory)?.label ?? selectedCategory}`,
          message: modalResult.value,
        });

        // Broadcast to owner dashboard via WebSocket
        socketManager.broadcast('ticket:created', {
          ticketId,
          category: selectedCategory,
          userId,
          username: interaction.user.username,
          guildId,
        });

        await modalResult.modalInteraction.deferUpdate();
        await session.setPage(buildSuccessPage(ticketId, selectedCategory));

        // Send the initial DM container so users have a conversation thread
        // before staff replies (fire-and-forget — don't block the flow)
        sendOrUpdateTicketDm(interaction.client as any, ticketId, userId, 'open').catch((err) =>
          logger.warn('Failed to send initial ticket DM', { ticketId, error: (err as Error).message }),
        );

        logger.info('Ticket created', { ticketId, category: selectedCategory, userId });
      } catch (err: any) {
        logger.error('Failed to create ticket', { error: err.message, userId });
        await modalResult.modalInteraction.deferUpdate();
        await session.setPage(buildErrorPage(userId, 'Something went wrong creating your ticket. Please try again later.'));
      }
      continue;
    }

    /* ── Appeal subcategory selected ── */
    if (cid === `ticket:${userId}:appealtype` && component.isStringSelectMenu()) {
      selectedSubcategory = component.values[0];

      // Validate eligibility
      const check = await validateAppealEligibility(userId, guildId, selectedSubcategory, hasManageGuild);

      if (!check.eligible) {
        await component.deferUpdate();
        await session.setPage(buildErrorPage(userId, check.reason!));
        continue;
      }

      // Show modal for appeal message
      const subcatLabel = APPEAL_SUBCATEGORIES.find(s => s.value === selectedSubcategory)?.label ?? 'Appeal';
      const modalResult = await session.showModal(component, {
        title: `Appeal: ${subcatLabel}`.slice(0, 45),
        fieldId: 'appeal_message',
        label: 'Why should your ban be lifted? (500 max)',
        placeholder: 'Explain your situation, what happened, and why you believe the ban should be lifted… (500 chars max)',
        required: true,
        style: 'paragraph',
        minLength: 30,
        maxLength: 500,
      });

      if (!modalResult) continue;

      // Rate limit check
      const appealRateCheck = await checkTicketCreationLimit(userId);
      if (!appealRateCheck.allowed) {
        await modalResult.modalInteraction.deferUpdate();
        await session.setPage(buildErrorPage(userId, appealRateCheck.reason!));
        continue;
      }

      try {
        const ticketId = await createTicket({
          guildId,
          userId,
          username: interaction.user.username,
          category: 'appeal',
          subcategory: selectedSubcategory,
          subject: `Appeal: ${subcatLabel}`,
          message: modalResult.value,
        });

        socketManager.broadcast('ticket:created', {
          ticketId,
          category: 'appeal',
          subcategory: selectedSubcategory,
          userId,
          username: interaction.user.username,
          guildId,
        });

        await modalResult.modalInteraction.deferUpdate();
        await session.setPage(buildSuccessPage(ticketId, 'appeal'));

        // Send the initial DM container so users have a conversation thread
        sendOrUpdateTicketDm(interaction.client as any, ticketId, userId, 'open').catch((err) =>
          logger.warn('Failed to send initial appeal ticket DM', { ticketId, error: (err as Error).message }),
        );

        logger.info('Appeal ticket created', { ticketId, subcategory: selectedSubcategory, userId });
      } catch (err: any) {
        logger.error('Failed to create appeal ticket', { error: err.message, userId });
        await modalResult.modalInteraction.deferUpdate();
        await session.setPage(buildErrorPage(userId, 'Something went wrong creating your appeal. Please try again later.'));
      }
      continue;
    }

    // Fallback: defer anything unhandled
    if (!component.deferred && !component.replied) {
      await component.deferUpdate().catch(() => {});
    }
  }

  return false;
}
