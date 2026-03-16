import { Client, TextChannel, ChannelType } from 'discord.js';
import { createModuleLogger } from '../../Shared/src/utils/logger';
const logger = createModuleLogger('ScheduledMessages');
import { getNextFireTime, buildEmbed, ScheduledMessage } from './helpers';

export class ScheduledMessageScheduler {
  private client: Client;
  private db: any;
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkInterval = 30 * 1000; // 30 seconds

  constructor(client: Client, db: any) {
    this.client = client;
    this.db = db;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('[ScheduledMessages] Scheduler already running');
      return;
    }

    this.isRunning = true;
    logger.info('[ScheduledMessages] Scheduler started');

    // Check immediately, then on interval
    this.checkAndSendMessages();
    this.interval = setInterval(() => this.checkAndSendMessages(), this.checkInterval);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    logger.info('[ScheduledMessages] Scheduler stopped');
  }

  /**
   * Check for messages that need to be sent and send them
   */
  private async checkAndSendMessages(): Promise<void> {
    try {
      const messages = await this.db.query(
        'SELECT * FROM scheduledMessages WHERE isActive = true'
      );

      const now = new Date();

      for (const message of messages) {
        let shouldSend = false;

        // Check one-time messages
        if (!message.isRecurring && message.scheduledFor) {
          const scheduledFor = new Date(message.scheduledFor);
          if (scheduledFor <= now) {
            shouldSend = true;
          }
        }
        // Check recurring messages
        else if (message.isRecurring && message.cronExpression) {
          const lastSent = message.lastSentAt ? new Date(message.lastSentAt) : null;
          
          // If never sent or enough time has passed
          if (!lastSent) {
            shouldSend = true;
          } else {
            try {
              const nextFireTime = getNextFireTime(message.cronExpression, lastSent);
              if (nextFireTime <= now) {
                shouldSend = true;
              }
            } catch (error) {
              logger.error('[ScheduledMessages] Failed to parse cron:', error);
            }
          }
        }

        if (shouldSend) {
          await this.sendMessage(message);
        }
      }
    } catch (error) {
      logger.error('[ScheduledMessages] Error checking messages:', error);
    }
  }

  /**
   * Send a scheduled message
   */
  private async sendMessage(message: ScheduledMessage): Promise<void> {
    try {
      const guild = this.client.guilds.cache.get(message.guildId!);
      if (!guild) {
        logger.warn(`[ScheduledMessages] Guild ${message.guildId!} not found`);
        await this.deactivateMessage(message.id);
        return;
      }

      const channel = guild.channels.cache.get(message.channelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        logger.warn(`[ScheduledMessages] Channel ${message.channelId} not found or not text`);
        await this.deactivateMessage(message.id);
        return;
      }

      const textChannel = channel as TextChannel;
      if (!textChannel.permissionsFor(guild.members.me!).has('SendMessages')) {
        logger.warn(`[ScheduledMessages] No permission to send in ${message.channelId}`);
        return;
      }

      // Build message content
      const content: any = {};
      
      if (message.content) {
        content.content = message.content;
      }

      // Note: embedData is stored as plain object for V2 compatibility
      // Components V2 doesn't support classic embeds, so we'll just include content
      if (message.embedData && !message.content) {
        try {
          const embedData = message.embedData;
          const parts = [];
          if (embedData.title) parts.push(`**${embedData.title}**`);
          if (embedData.description) parts.push(embedData.description);
          if (embedData.fields && Array.isArray(embedData.fields)) {
            for (const field of embedData.fields) {
              parts.push(`**${field.name}**\n${field.value}`);
            }
          }
          if (parts.length > 0) {
            content.content = parts.join('\n\n');
          }
        } catch (error) {
          logger.error('[ScheduledMessages] Failed to parse embed data:', error);
        }
      }

      if (!content.content && (!content.embeds || content.embeds.length === 0)) {
        logger.warn('[ScheduledMessages] No content or embeds to send');
        return;
      }

      // Send the message
      await textChannel.send(content);
      logger.info(`[ScheduledMessages] Sent message ${message.id} to ${message.channelId}`);

      // Update last sent time and handle recurrence
      const now = new Date();
      if (message.isRecurring) {
        await this.db.query(
          'UPDATE scheduledMessages SET lastSentAt = $1 WHERE id = $2',
          [now, message.id]
        );
      } else {
        // One-time message: deactivate after sending
        await this.deactivateMessage(message.id);
      }

      // Emit audit log event
      if (this.client.emit) {
        this.client.emit('auditLog', {
          action: 'SCHEDULED_MESSAGE_SENT',
          guildId: message.guildId!,
          userId: message.creatorId,
          target: message.id,
          details: `Scheduled message sent to ${message.channelId}`,
        });
      }
    } catch (error) {
      logger.error(`[ScheduledMessages] Failed to send message ${message.id}:`, error);
    }
  }

  /**
   * Deactivate a scheduled message
   */
  private async deactivateMessage(messageId: string): Promise<void> {
    try {
      await this.db.query(
        'UPDATE scheduledMessages SET isActive = false WHERE id = $1',
        [messageId]
      );
    } catch (error) {
      logger.error('[ScheduledMessages] Failed to deactivate message:', error);
    }
  }
}
