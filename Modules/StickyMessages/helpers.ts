import { Client, APIEmbed } from 'discord.js';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { getPool } from '../../Shared/src/database/connection';
const logger = createModuleLogger('StickyMessages');


export interface StickyMessageRecord {
  id: string;
  guildId: string;
  channelId: string;
  content: string;
  embedData: APIEmbed | null;
  currentMessageId: string | null;
  interval: number;
  messagesSince: number;
  priority: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StickyConfig {
  enabled: boolean;
  mode: 'interval' | 'activity' | 'hybrid';
  maxStickiesPerChannel: number;
  deleteBotMessage: boolean;
}

const DEFAULT_CONFIG: StickyConfig = {
  enabled: true,
  mode: 'interval',
  maxStickiesPerChannel: 3,
  deleteBotMessage: true,
};

export class StickyMessagesHelper {
  constructor(private db: any = getPool()) {}

  // ===== Sticky Message Operations =====

  async createStickyMessage(
    guildId: string,
    channelId: string,
    content: string,
    embedData: APIEmbed | null,
    interval: number,
    priority: number = 0
  ): Promise<StickyMessageRecord> {
    try {
      const id = `sticky_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const result = await this.db.query(
        `INSERT INTO stickyMessages 
         (id, guildId, channelId, content, embedData, interval, messagesSince, priority, isActive)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          id,
          guildId,
          channelId,
          content,
          embedData ? JSON.stringify(embedData) : null,
          interval,
          0,
          priority,
          true,
        ]
      );

      return this.mapRow(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to create sticky message: ${error}`);
      throw error;
    }
  }

  async getStickyMessage(stickyId: string): Promise<StickyMessageRecord | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM stickyMessages WHERE id = $1',
        [stickyId]
      );

      return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Failed to get sticky message: ${error}`);
      throw error;
    }
  }

  async getStickyMessagesByChannel(
    channelId: string
  ): Promise<StickyMessageRecord[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM stickyMessages WHERE channelId = $1 AND isActive = true ORDER BY priority DESC, id ASC',
        [channelId]
      );

      return result.rows.map((row: any) => this.mapRow(row));
    } catch (error) {
      logger.error(`Failed to get sticky messages for channel: ${error}`);
      throw error;
    }
  }

  async getStickyMessagesByGuild(
    guildId: string
  ): Promise<StickyMessageRecord[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM stickyMessages WHERE guildId = $1 AND isActive = true ORDER BY priority DESC, id ASC',
        [guildId]
      );

      return result.rows.map((row: any) => this.mapRow(row));
    } catch (error) {
      logger.error(`Failed to get sticky messages for guild: ${error}`);
      throw error;
    }
  }

  async updateStickyMessage(
    stickyId: string,
    updates: {
      content?: string;
      embedData?: APIEmbed | null;
      interval?: number;
      priority?: number;
      currentMessageId?: string | null;
      messagesSince?: number;
      isActive?: boolean;
    }
  ): Promise<StickyMessageRecord> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.content !== undefined) {
        fields.push(`content = $${paramIndex++}`);
        values.push(updates.content);
      }
      if (updates.embedData !== undefined) {
        fields.push(`embedData = $${paramIndex++}`);
        values.push(updates.embedData ? JSON.stringify(updates.embedData) : null);
      }
      if (updates.interval !== undefined) {
        fields.push(`interval = $${paramIndex++}`);
        values.push(updates.interval);
      }
      if (updates.priority !== undefined) {
        fields.push(`priority = $${paramIndex++}`);
        values.push(updates.priority);
      }
      if (updates.currentMessageId !== undefined) {
        fields.push(`currentMessageId = $${paramIndex++}`);
        values.push(updates.currentMessageId);
      }
      if (updates.messagesSince !== undefined) {
        fields.push(`messagesSince = $${paramIndex++}`);
        values.push(updates.messagesSince);
      }
      if (updates.isActive !== undefined) {
        fields.push(`isActive = $${paramIndex++}`);
        values.push(updates.isActive);
      }

      values.push(stickyId);

      const result = await this.db.query(
        `UPDATE stickyMessages SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      return this.mapRow(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to update sticky message: ${error}`);
      throw error;
    }
  }

  async deleteStickyMessage(stickyId: string): Promise<void> {
    try {
      await this.db.query('DELETE FROM stickyMessages WHERE id = $1', [
        stickyId,
      ]);
    } catch (error) {
      logger.error(`Failed to delete sticky message: ${error}`);
      throw error;
    }
  }

  async deactivateStickyMessage(stickyId: string): Promise<StickyMessageRecord> {
    return this.updateStickyMessage(stickyId, { isActive: false });
  }

  async incrementMessagesSince(stickyId: string): Promise<StickyMessageRecord> {
    try {
      const sticky = await this.getStickyMessage(stickyId);
      if (!sticky) throw new Error('Sticky message not found');

      return this.updateStickyMessage(stickyId, {
        messagesSince: sticky.messagesSince + 1,
      });
    } catch (error) {
      logger.error(`Failed to increment messagesSince: ${error}`);
      throw error;
    }
  }

  async resetMessagesSince(stickyId: string): Promise<StickyMessageRecord> {
    return this.updateStickyMessage(stickyId, { messagesSince: 0 });
  }

  // ===== Configuration Operations =====

  async getGuildConfig(guildId: string): Promise<StickyConfig> {
    try {
      const result = await this.db.query(
        'SELECT config FROM stickyConfigs WHERE guildId = $1',
        [guildId]
      );

      if (result.rows.length === 0) {
        return { ...DEFAULT_CONFIG };
      }

      return { ...DEFAULT_CONFIG, ...result.rows[0].config };
    } catch (error) {
      logger.error(`Failed to get guild config: ${error}`);
      return { ...DEFAULT_CONFIG };
    }
  }

  async updateGuildConfig(
    guildId: string,
    config: Partial<StickyConfig>
  ): Promise<StickyConfig> {
    try {
      const existing = await this.getGuildConfig(guildId);
      const updated = { ...existing, ...config };

      await this.db.query(
        `INSERT INTO stickyConfigs (guildId, config) 
         VALUES ($1, $2)
         ON CONFLICT (guildId) DO UPDATE SET config = $2`,
        [guildId, JSON.stringify(updated)]
      );

      return updated;
    } catch (error) {
      logger.error(`Failed to update guild config: ${error}`);
      throw error;
    }
  }

  // ===== Utility Methods =====

  buildEmbedData(embedData: APIEmbed | null): APIEmbed | null {
    if (!embedData) return null;

    try {
      // Return the raw embed data - can be used with V2 or legacy embeds
      return embedData;
    } catch (error) {
      logger.error(`Failed to process embed data: ${error}`);
      return null;
    }
  }

  async validateSticky(
    client: Client,
    sticky: StickyMessageRecord
  ): Promise<boolean> {
    try {
      const guild = await client.guilds.fetch(sticky.guildId);
      if (!guild) return false;

      const channel = await guild.channels.fetch(sticky.channelId);
      if (!channel || !channel.isTextBased()) return false;

      // Check if bot has permissions
      if ('permissionsFor' in channel) {
        const botMember = await guild.members.fetchMe();
        const permissions = channel.permissionsFor(botMember);
        if (!permissions?.has(['SendMessages', 'ManageMessages'])) return false;
      }

      return true;
    } catch (error) {
      logger.error(`Failed to validate sticky: ${error}`);
      return false;
    }
  }

  private mapRow(row: any): StickyMessageRecord {
    return {
      id: row.id,
      guildId: row.guildId,
      channelId: row.channelId,
      content: row.content,
      embedData: row.embedData
        ? typeof row.embedData === 'string'
          ? JSON.parse(row.embedData)
          : row.embedData
        : null,
      currentMessageId: row.currentMessageId,
      interval: row.interval,
      messagesSince: row.messagesSince,
      priority: row.priority,
      isActive: row.isActive,
      createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
    };
  }
}
