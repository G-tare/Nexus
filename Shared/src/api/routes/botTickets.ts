/**
 * Bot Ticket API Routes — Owner dashboard endpoints for managing bot-level tickets.
 *
 * All routes require owner authentication (authMiddleware + ownerMiddleware).
 *
 * Endpoints:
 *  GET    /api/owner/tickets           — List tickets (with filters)
 *  GET    /api/owner/tickets/:id       — Get single ticket with messages
 *  PATCH  /api/owner/tickets/:id/claim — Claim a ticket
 *  PATCH  /api/owner/tickets/:id/close — Close a ticket
 *  POST   /api/owner/tickets/:id/reply — Reply to a ticket (sends DM)
 *  GET    /api/owner/tickets/stats     — Ticket statistics
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { socketManager } from '../../websocket/socketManager';
import { publishStaffReply, publishTicketClose, publishStaffAttachment } from '../../handlers/botTicketDmHandler';
import { createModuleLogger } from '../../utils/logger';
import multer from 'multer';

const logger = createModuleLogger('TicketAPI');
export const botTicketsRouter = Router();

// Multer for file uploads (max 8MB, stored in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

/* ── GET /tickets — List tickets with optional filters ── */

botTicketsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const {
      status,
      category,
      page = '1',
      limit = '20',
      search,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (status === 'open') {
      // "Open" means all active (non-closed) tickets: both 'open' and 'claimed'
      conditions.push(`bt.status IN ('open', 'claimed')`);
    } else if (status && ['claimed', 'closed'].includes(status)) {
      conditions.push(`bt.status = $${paramIdx++}`);
      params.push(status);
    }
    if (category && ['help', 'appeal', 'suggestion', 'bug', 'feedback'].includes(category)) {
      conditions.push(`bt.category = $${paramIdx++}`);
      params.push(category);
    }
    if (search) {
      conditions.push(`(bt.subject ILIKE $${paramIdx} OR bt.username ILIKE $${paramIdx} OR bt.user_id = $${paramIdx + 1})`);
      params.push(`%${search}%`, search);
      paramIdx += 2;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM bot_tickets bt ${where}`,
      params,
    );

    const result = await pool.query(
      `SELECT bt.id, bt.guild_id, bt.user_id, bt.username, bt.category, bt.subcategory, bt.status, bt.subject,
              bt.claimed_by, bt.closed_by, bt.created_at, bt.updated_at, bt.closed_at, bt.last_staff_read_at,
              (SELECT COUNT(*)::int FROM bot_ticket_messages btm
               WHERE btm.ticket_id = bt.id AND btm.author_type = 'user'
               AND btm.created_at > COALESCE(bt.last_staff_read_at, '1970-01-01')
              ) AS unread_count
       FROM bot_tickets bt ${where}
       ORDER BY
         CASE bt.status WHEN 'open' THEN 0 WHEN 'claimed' THEN 1 ELSE 2 END,
         bt.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limitNum, offset],
    );

    res.json({
      tickets: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(countResult.rows[0].total, 10),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total, 10) / limitNum),
      },
    });
  } catch (err: any) {
    logger.error('Failed to list tickets', { error: err.message });
    res.status(500).json({ error: 'Failed to list tickets' });
  }
});

/* ── GET /tickets/stats — Aggregate statistics ── */

botTicketsRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open') as open_count,
        COUNT(*) FILTER (WHERE status = 'claimed') as claimed_count,
        COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE category = 'help') as help_count,
        COUNT(*) FILTER (WHERE category = 'appeal') as appeal_count,
        COUNT(*) FILTER (WHERE category = 'suggestion') as suggestion_count,
        COUNT(*) FILTER (WHERE category = 'bug') as bug_count,
        COUNT(*) FILTER (WHERE category = 'feedback') as feedback_count,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
        AVG(EXTRACT(EPOCH FROM (COALESCE(closed_at, NOW()) - created_at)))
          FILTER (WHERE status = 'closed') as avg_resolution_seconds
      FROM bot_tickets
    `);

    res.json(result.rows[0]);
  } catch (err: any) {
    logger.error('Failed to get ticket stats', { error: err.message });
    res.status(500).json({ error: 'Failed to get ticket stats' });
  }
});

/* ── GET /tickets/:id — Single ticket with messages ── */

botTicketsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const ticketId = parseInt(req.params.id as string, 10);

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'Invalid ticket ID' });
      return;
    }

    const ticketResult = await pool.query(
      'SELECT * FROM bot_tickets WHERE id = $1',
      [ticketId],
    );

    if (!ticketResult.rows[0]) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    const messagesResult = await pool.query(
      'SELECT * FROM bot_ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC',
      [ticketId],
    );

    res.json({
      ticket: ticketResult.rows[0],
      messages: messagesResult.rows,
    });
  } catch (err: any) {
    logger.error('Failed to get ticket', { error: err.message, ticketId: req.params.id });
    res.status(500).json({ error: 'Failed to get ticket' });
  }
});

/* ── PATCH /tickets/:id/read — Mark a ticket's messages as read by staff ── */

botTicketsRouter.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const ticketId = parseInt(req.params.id as string, 10);

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'Invalid ticket ID' });
      return;
    }

    await pool.query(
      'UPDATE bot_tickets SET last_staff_read_at = NOW() WHERE id = $1',
      [ticketId],
    );

    res.json({ success: true });
  } catch (err: any) {
    logger.error('Failed to mark ticket as read', { error: err.message });
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

/* ── PATCH /tickets/:id/claim — Claim a ticket ── */

botTicketsRouter.patch('/:id/claim', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const ticketId = parseInt(req.params.id as string, 10);
    const staffId = req.user!.id;

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'Invalid ticket ID' });
      return;
    }

    const result = await pool.query(
      `UPDATE bot_tickets
       SET status = 'claimed', claimed_by = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'open'
       RETURNING id, status, claimed_by`,
      [staffId, ticketId],
    );

    if (!result.rows[0]) {
      res.status(400).json({ error: 'Ticket not found or already claimed/closed' });
      return;
    }

    socketManager.broadcast('ticket:claimed', {
      ticketId,
      claimedBy: staffId,
    });

    res.json(result.rows[0]);
  } catch (err: any) {
    logger.error('Failed to claim ticket', { error: err.message, ticketId: req.params.id });
    res.status(500).json({ error: 'Failed to claim ticket' });
  }
});

/* ── PATCH /tickets/:id/close — Close a ticket ── */

botTicketsRouter.patch('/:id/close', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const ticketId = parseInt(req.params.id as string, 10);
    const staffId = req.user!.id;
    const { reason } = req.body as { reason?: string };

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'Invalid ticket ID' });
      return;
    }

    // Get user_id before closing so we can notify them
    const ticketInfo = await pool.query(
      'SELECT user_id FROM bot_tickets WHERE id = $1 AND status != \'closed\'',
      [ticketId],
    );

    if (!ticketInfo.rows[0]) {
      res.status(400).json({ error: 'Ticket not found or already closed' });
      return;
    }

    const ticketUserId = ticketInfo.rows[0].user_id;

    const result = await pool.query(
      `UPDATE bot_tickets
       SET status = 'closed', closed_by = $1, closed_reason = $2, closed_at = NOW(), updated_at = NOW()
       WHERE id = $3 AND status != 'closed'
       RETURNING id, status, closed_by, closed_reason`,
      [staffId, reason || null, ticketId],
    );

    if (!result.rows[0]) {
      res.status(400).json({ error: 'Ticket not found or already closed' });
      return;
    }

    socketManager.broadcast('ticket:closed', {
      ticketId,
      closedBy: staffId,
      reason: reason || null,
    });

    // Queue a "ticket closed" DM to the user (bot process will send it)
    await publishTicketClose({
      ticketId,
      userId: ticketUserId,
      closedBy: staffId,
      reason: reason || null,
    });

    res.json(result.rows[0]);
  } catch (err: any) {
    logger.error('Failed to close ticket', { error: err.message, ticketId: req.params.id });
    res.status(500).json({ error: 'Failed to close ticket' });
  }
});

/* ── GET /tickets/:id/evidence — Related moderation evidence ── */

botTicketsRouter.get('/:id/evidence', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const ticketId = parseInt(req.params.id as string, 10);

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'Invalid ticket ID' });
      return;
    }

    // Get ticket to know the user, category, subcategory
    const ticketResult = await pool.query(
      'SELECT user_id, guild_id, category, subcategory FROM bot_tickets WHERE id = $1',
      [ticketId],
    );

    if (!ticketResult.rows[0]) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    const { user_id: userId, guild_id: guildId, category, subcategory } = ticketResult.rows[0];

    const evidence: {
      modCases: any[];
      automodLogs: any[];
      reports: any[];
      banRecord: any | null;
    } = {
      modCases: [],
      automodLogs: [],
      reports: [],
      banRecord: null,
    };

    // Fetch moderation cases for this user (across all guilds)
    const casesResult = await pool.query(
      `SELECT id, guild_id, case_number, action, target_id, moderator_id, reason, duration, expires_at, is_active, created_at
       FROM mod_cases
       WHERE target_id = $1
       ORDER BY created_at DESC
       LIMIT 25`,
      [userId],
    );
    evidence.modCases = casesResult.rows;

    // Fetch automod violations for this user
    const automodResult = await pool.query(
      `SELECT id, guild_id, target_id, action, violation_type, reason, message_content, channel_id, duration, created_at
       FROM automod_logs
       WHERE target_id = $1
       ORDER BY created_at DESC
       LIMIT 25`,
      [userId],
    );
    evidence.automodLogs = automodResult.rows;

    // Fetch reports involving this user (as target)
    const reportsResult = await pool.query(
      `SELECT id, guild_id, reporter_id, type, target_id, reason, evidence, status, staff_notes, created_at, resolved_at, resolved_by
       FROM reports
       WHERE target_id = $1
       ORDER BY created_at DESC
       LIMIT 25`,
      [userId],
    );
    evidence.reports = reportsResult.rows;

    // For appeal tickets, fetch the specific ban record
    if (category === 'appeal' && subcategory) {
      switch (subcategory) {
        case 'userphone_server_ban': {
          if (guildId) {
            const banResult = await pool.query(
              `SELECT id, guild_id, reason, banned_by, report_id, is_active, created_at, expires_at
               FROM userphone_server_bans
               WHERE guild_id = $1 AND is_active = true
               ORDER BY created_at DESC LIMIT 1`,
              [guildId],
            );
            if (banResult.rows[0]) evidence.banRecord = { type: 'userphone_server_ban', ...banResult.rows[0] };
          }
          break;
        }
        case 'voicephone_server_ban': {
          if (guildId) {
            // VoicePhone uses its own table or shares the same structure
            const banResult = await pool.query(
              `SELECT id, guild_id, reason, banned_by, report_id, is_active, created_at, expires_at
               FROM userphone_server_bans
               WHERE guild_id = $1 AND is_active = true
               ORDER BY created_at DESC LIMIT 1`,
              [guildId],
            );
            if (banResult.rows[0]) evidence.banRecord = { type: 'voicephone_server_ban', ...banResult.rows[0] };
          }
          break;
        }
        case 'userphone_user_ban': {
          const banResult = await pool.query(
            `SELECT user_id, reason, banned_by, banned_at
             FROM userphone_user_bans
             WHERE user_id = $1
             LIMIT 1`,
            [userId],
          );
          if (banResult.rows[0]) evidence.banRecord = { type: 'userphone_user_ban', ...banResult.rows[0] };
          break;
        }
        case 'voicephone_user_ban': {
          const banResult = await pool.query(
            `SELECT user_id, reason, banned_by, banned_at
             FROM userphone_user_bans
             WHERE user_id = $1
             LIMIT 1`,
            [userId],
          );
          if (banResult.rows[0]) evidence.banRecord = { type: 'voicephone_user_ban', ...banResult.rows[0] };
          break;
        }
      }
    }

    res.json(evidence);
  } catch (err: any) {
    logger.error('Failed to get ticket evidence', { error: err.message, ticketId: req.params.id });
    res.status(500).json({ error: 'Failed to get evidence' });
  }
});

/* ── POST /tickets/:id/reply — Staff reply (sends DM to user) ── */

botTicketsRouter.post('/:id/reply', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const ticketId = parseInt(req.params.id as string, 10);
    const staffId = req.user!.id;
    const staffName = req.user!.username;
    const { message } = req.body as { message?: string };

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'Invalid ticket ID' });
      return;
    }

    if (!message || message.trim().length === 0) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    if (message.trim().length > 500) {
      res.status(400).json({ error: 'Message must be 500 characters or fewer' });
      return;
    }

    // Verify ticket exists and is not closed
    const ticketResult = await pool.query(
      'SELECT id, user_id, status FROM bot_tickets WHERE id = $1',
      [ticketId],
    );

    if (!ticketResult.rows[0]) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    if (ticketResult.rows[0].status === 'closed') {
      res.status(400).json({ error: 'Cannot reply to a closed ticket' });
      return;
    }

    const userId = ticketResult.rows[0].user_id;

    // Insert the staff message
    await pool.query(
      `INSERT INTO bot_ticket_messages (ticket_id, author_type, author_id, author_name, message, attachments)
       VALUES ($1, 'staff', $2, $3, $4, '[]'::jsonb)`,
      [ticketId, staffId, staffName, message.trim()],
    );

    // Update ticket timestamp, auto-claim if unclaimed, and mark as read
    await pool.query(
      `UPDATE bot_tickets
       SET updated_at = NOW(),
           last_staff_read_at = NOW(),
           status = CASE WHEN status = 'open' THEN 'claimed' ELSE status END,
           claimed_by = CASE WHEN claimed_by IS NULL THEN $1 ELSE claimed_by END
       WHERE id = $2`,
      [staffId, ticketId],
    );

    // Broadcast message to WebSocket for real-time dashboard updates
    socketManager.broadcast('ticket:message', {
      ticketId,
      authorType: 'staff',
      authorId: staffId,
      authorName: staffName,
      message: message.trim(),
    });

    // Publish via Redis pub/sub so the bot process can send the DM via Discord client
    await publishStaffReply({
      ticketId,
      userId,
      staffName,
      message: message.trim(),
    });

    res.json({
      success: true,
      ticketId,
      userId,
      message: 'Reply saved. DM will be sent to the user.',
    });
  } catch (err: any) {
    logger.error('Failed to reply to ticket', { error: err.message, ticketId: req.params.id });
    res.status(500).json({ error: 'Failed to reply to ticket' });
  }
});

/* ── POST /tickets/:id/attachment — Staff file upload (sends via bot DM) ── */

botTicketsRouter.post('/:id/attachment', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const ticketId = parseInt(req.params.id as string, 10);
    const staffId = req.user!.id;
    const staffName = req.user!.username;

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'Invalid ticket ID' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    // Verify ticket exists and is not closed
    const ticketResult = await pool.query(
      'SELECT id, user_id, status FROM bot_tickets WHERE id = $1',
      [ticketId],
    );

    if (!ticketResult.rows[0]) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    if (ticketResult.rows[0].status === 'closed') {
      res.status(400).json({ error: 'Cannot send attachments to a closed ticket' });
      return;
    }

    const userId = ticketResult.rows[0].user_id;

    // Encode file as base64 and publish to the attachment queue
    const base64Data = req.file.buffer.toString('base64');
    const filename = req.file.originalname || 'file';
    const contentType = req.file.mimetype || 'application/octet-stream';

    await publishStaffAttachment({
      ticketId,
      userId,
      staffId,
      staffName,
      filename,
      base64Data,
      contentType,
    });

    // Auto-claim if unclaimed + mark as read
    await pool.query(
      `UPDATE bot_tickets
       SET updated_at = NOW(),
           last_staff_read_at = NOW(),
           status = CASE WHEN status = 'open' THEN 'claimed' ELSE status END,
           claimed_by = CASE WHEN claimed_by IS NULL THEN $1 ELSE claimed_by END
       WHERE id = $2`,
      [staffId, ticketId],
    );

    res.json({
      success: true,
      ticketId,
      filename,
      message: 'File queued for delivery. It will be sent to the user via DM.',
    });
  } catch (err: any) {
    logger.error('Failed to upload attachment', { error: err.message, ticketId: req.params.id });
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

/* ── PATCH /tickets/:id/reopen — Reopen a closed ticket ── */

botTicketsRouter.patch('/:id/reopen', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const ticketId = parseInt(req.params.id as string, 10);
    const staffId = req.user!.id;

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'Invalid ticket ID' });
      return;
    }

    // Fetch the closed ticket
    const ticketResult = await pool.query(
      'SELECT id, user_id, status, closed_by FROM bot_tickets WHERE id = $1',
      [ticketId],
    );

    if (!ticketResult.rows[0]) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    if (ticketResult.rows[0].status !== 'closed') {
      res.status(400).json({ error: 'Ticket is not closed' });
      return;
    }

    // Reopen it — set status back to 'open', clear closed fields
    const result = await pool.query(
      `UPDATE bot_tickets
       SET status = 'open', closed_by = NULL, closed_reason = NULL, closed_at = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id, status`,
      [ticketId],
    );

    // Broadcast reopen event
    socketManager.broadcast('ticket:reopened', {
      ticketId,
      reopenedBy: staffId,
    });

    // Notify the user via DM that their ticket was reopened
    const userId = ticketResult.rows[0].user_id;

    // Insert a system message
    await pool.query(
      `INSERT INTO bot_ticket_messages (ticket_id, author_type, author_id, author_name, message, attachments)
       VALUES ($1, 'staff', $2, 'System', 'Ticket reopened by staff.', '[]'::jsonb)`,
      [ticketId, staffId],
    );

    // Queue DM update
    await publishStaffReply({
      ticketId,
      userId,
      staffName: 'System',
      message: 'Ticket reopened by staff.',
    });

    res.json(result.rows[0]);
  } catch (err: any) {
    logger.error('Failed to reopen ticket', { error: err.message, ticketId: req.params.id });
    res.status(500).json({ error: 'Failed to reopen ticket' });
  }
});

/* ── GET /tickets/bans — List all ticket-banned users ── */

botTicketsRouter.get('/bans/list', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, user_id, username, banned_by, reason, created_at FROM bot_ticket_bans ORDER BY created_at DESC',
    );
    res.json({ bans: result.rows });
  } catch (err: any) {
    logger.error('Failed to list ticket bans', { error: err.message });
    res.status(500).json({ error: 'Failed to list ticket bans' });
  }
});

/* ── POST /tickets/bans — Ban a user from creating tickets ── */

botTicketsRouter.post('/bans', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const staffId = req.user!.id;
    const { userId, username, reason } = req.body as { userId?: string; username?: string; reason?: string };

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    // Check if already banned
    const existing = await pool.query(
      'SELECT id FROM bot_ticket_bans WHERE user_id = $1',
      [userId],
    );

    if (existing.rows[0]) {
      res.status(409).json({ error: 'User is already banned from tickets' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO bot_ticket_bans (user_id, username, banned_by, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, username, banned_by, reason, created_at`,
      [userId, username || '', staffId, reason || null],
    );

    // Find all open tickets from this user so we can notify via DM
    const openTickets = await pool.query(
      `SELECT id FROM bot_tickets WHERE user_id = $1 AND status != 'closed'`,
      [userId],
    );

    // Close all open tickets from this user
    await pool.query(
      `UPDATE bot_tickets
       SET status = 'closed', closed_by = $1, closed_reason = 'User banned from tickets', closed_at = NOW(), updated_at = NOW()
       WHERE user_id = $2 AND status != 'closed'`,
      [staffId, userId],
    );

    // Queue close DMs for each affected ticket so the embed updates in Discord
    for (const row of openTickets.rows) {
      await publishTicketClose({
        ticketId: row.id,
        userId,
        closedBy: staffId,
        reason: 'User banned from tickets',
      });

      socketManager.broadcast('ticket:closed', {
        ticketId: row.id,
        closedBy: staffId,
        reason: 'User banned from tickets',
      });
    }

    logger.info('User banned from tickets', { userId, bannedBy: staffId, reason });
    res.json(result.rows[0]);
  } catch (err: any) {
    logger.error('Failed to ban user from tickets', { error: err.message });
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

/* ── DELETE /tickets/bans/:userId — Unban a user ── */

botTicketsRouter.delete('/bans/:userId', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { userId } = req.params;

    const result = await pool.query(
      'DELETE FROM bot_ticket_bans WHERE user_id = $1 RETURNING id',
      [userId],
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'User is not banned from tickets' });
      return;
    }

    logger.info('User unbanned from tickets', { userId });
    res.json({ success: true, userId });
  } catch (err: any) {
    logger.error('Failed to unban user from tickets', { error: err.message });
    res.status(500).json({ error: 'Failed to unban user' });
  }
});
