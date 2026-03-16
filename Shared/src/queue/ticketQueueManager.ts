/**
 * TicketQueueManager — Direct in-process message passing for ticket DMs.
 *
 * Replaces the Redis list polling pattern (RPUSH + LPOP every 3s) that was
 * burning ~2.6M Redis commands/month. Since the API server and bot run in
 * the same Node.js process, we can use direct function calls instead.
 *
 * The bot registers its handler functions on startup.
 * The API routes call enqueue* methods which invoke the handlers directly.
 */

import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('TicketQueue');

export interface TicketDmData {
  ticketId: number;
  userId: string;
  staffName: string;
  message: string;
  attachments?: Array<{
    url: string;
    filename: string;
    contentType: string | null;
  }>;
}

export interface TicketCloseData {
  ticketId: number;
  userId: string;
  closedBy: string;
  reason: string | null;
}

export interface TicketAttachData {
  ticketId: number;
  userId: string;
  staffId: string;
  staffName: string;
  filename: string;
  base64Data: string;
  contentType: string;
}

type DmHandler = (data: TicketDmData) => Promise<void>;
type CloseHandler = (data: TicketCloseData) => Promise<void>;
type AttachHandler = (data: TicketAttachData) => Promise<void>;

class TicketQueueManager {
  private dmHandler: DmHandler | null = null;
  private closeHandler: CloseHandler | null = null;
  private attachHandler: AttachHandler | null = null;

  /**
   * Register the DM handler (called by bot on startup).
   */
  registerDmHandler(fn: DmHandler): void {
    this.dmHandler = fn;
    logger.info('DM handler registered');
  }

  /**
   * Register the close handler (called by bot on startup).
   */
  registerCloseHandler(fn: CloseHandler): void {
    this.closeHandler = fn;
    logger.info('Close handler registered');
  }

  /**
   * Register the attachment handler (called by bot on startup).
   */
  registerAttachHandler(fn: AttachHandler): void {
    this.attachHandler = fn;
    logger.info('Attach handler registered');
  }

  /**
   * Enqueue a staff reply DM. Called from API routes.
   * Invokes the handler directly — no Redis, no polling.
   */
  async enqueueDm(data: TicketDmData): Promise<void> {
    if (!this.dmHandler) {
      logger.warn('DM handler not registered, dropping message', { ticketId: data.ticketId });
      return;
    }

    try {
      await this.dmHandler(data);
    } catch (err: any) {
      logger.error('DM handler error', { ticketId: data.ticketId, error: err.message });
    }
  }

  /**
   * Enqueue a ticket close notification. Called from API routes.
   */
  async enqueueClose(data: TicketCloseData): Promise<void> {
    if (!this.closeHandler) {
      logger.warn('Close handler not registered, dropping message', { ticketId: data.ticketId });
      return;
    }

    try {
      await this.closeHandler(data);
    } catch (err: any) {
      logger.error('Close handler error', { ticketId: data.ticketId, error: err.message });
    }
  }

  /**
   * Enqueue a staff attachment. Called from API routes.
   */
  async enqueueAttach(data: TicketAttachData): Promise<void> {
    if (!this.attachHandler) {
      logger.warn('Attach handler not registered, dropping message', { ticketId: data.ticketId });
      return;
    }

    try {
      await this.attachHandler(data);
    } catch (err: any) {
      logger.error('Attach handler error', { ticketId: data.ticketId, error: err.message });
    }
  }

  /**
   * Check if all handlers are registered (for health checks).
   */
  isReady(): boolean {
    return this.dmHandler !== null && this.closeHandler !== null && this.attachHandler !== null;
  }
}

/** Singleton ticket queue — shared between API routes and bot handlers. */
export const ticketQueue = new TicketQueueManager();
