import { Pool, QueryResult } from 'pg';
import { createModuleLogger } from '../../Shared/src/utils/logger';
const logger = createModuleLogger('CustomCommands');

export interface CustomCommand {
  id: string;
  guildId: string;
  name: string;
  aliases?: string[];
  response: string;
  embedResponse?: boolean;
  requiredRoleId?: string;
  cooldown?: number;
  useCount?: number;
  createdBy?: string;
  createdAt?: Date;
  dm?: boolean;
  ephemeral?: boolean;
  deleteInvocation?: boolean;
  addReaction?: string;
  allowedChannels?: string[];
}

export class CustomCommandsHelper {
  constructor(private pool: Pool) {}

  /**
   * Create a new custom command
   */
  async createCommand(
    guildId: string,
    name: string,
    response: string,
    createdBy: string,
    options?: Partial<CustomCommand>
  ): Promise<CustomCommand> {
    const query = `
      INSERT INTO custom_commands 
      (guild_id, name, aliases, response, embed_response, required_role_id, 
       cooldown, created_by, created_at, dm, ephemeral, delete_invocation, 
       add_reaction, allowed_channels)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      guildId,
      name,
      JSON.stringify(options?.aliases || []),
      response,
      options?.embedResponse || false,
      options?.requiredRoleId || null,
      options?.cooldown || 0,
      createdBy,
      new Date(),
      options?.dm || false,
      options?.ephemeral || false,
      options?.deleteInvocation || false,
      options?.addReaction || null,
      JSON.stringify(options?.allowedChannels || [])
    ];

    try {
      const result = await this.pool.query(query, values);
      return this.formatCommand(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create custom command', error);
      throw error;
    }
  }

  /**
   * Get a custom command by name
   */
  async getCommand(guildId: string, name: string): Promise<CustomCommand | null> {
    const query = `
      SELECT * FROM custom_commands 
      WHERE guild_id = $1 AND (name = $2 OR aliases @> $3::jsonb)
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [guildId, name.toLowerCase(), JSON.stringify([name.toLowerCase()])]);
      return result.rows.length > 0 ? this.formatCommand(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to get custom command', error);
      throw error;
    }
  }

  /**
   * Get all custom commands for a guild
   */
  async getGuildCommands(guildId: string): Promise<CustomCommand[]> {
    const query = `
      SELECT * FROM custom_commands 
      WHERE guild_id = $1 
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.pool.query(query, [guildId]);
      return result.rows.map(row => this.formatCommand(row));
    } catch (error) {
      logger.error('Failed to get guild custom commands', error);
      throw error;
    }
  }

  /**
   * Update a custom command
   */
  async updateCommand(commandId: string, updates: Partial<CustomCommand>): Promise<CustomCommand> {
    const allowedFields = [
      'response',
      'embed_response',
      'required_role_id',
      'cooldown',
      'dm',
      'ephemeral',
      'delete_invocation',
      'add_reaction',
      'allowed_channels'
    ];

    const updates_map: { [key: string]: string } = {
      'embedResponse': 'embed_response',
      'requiredRoleId': 'required_role_id',
      'deleteInvocation': 'delete_invocation',
      'addReaction': 'add_reaction',
      'allowedChannels': 'allowed_channels'
    };

    const setClauses: string[] = [];
    const values: any[] = [commandId];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(updates)) {
      let dbField = updates_map[key] || key;

      if (!allowedFields.includes(dbField)) continue;

      if (key === 'allowedChannels' || key === 'aliases') {
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else {
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(value);
      }

      paramIndex++;
    }

    if (setClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    const query = `
      UPDATE custom_commands 
      SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, values);
      return this.formatCommand(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update custom command', error);
      throw error;
    }
  }

  /**
   * Delete a custom command
   */
  async deleteCommand(commandId: string): Promise<boolean> {
    const query = 'DELETE FROM custom_commands WHERE id = $1';

    try {
      const result = await this.pool.query(query, [commandId]);
      return result.rowCount! > 0;
    } catch (error) {
      logger.error('Failed to delete custom command', error);
      throw error;
    }
  }

  /**
   * Increment use count for a command
   */
  async incrementUseCount(commandId: string): Promise<void> {
    const query = `
      UPDATE custom_commands 
      SET use_count = COALESCE(use_count, 0) + 1
      WHERE id = $1
    `;

    try {
      await this.pool.query(query, [commandId]);
    } catch (error) {
      logger.error('Failed to increment use count', error);
      throw error;
    }
  }

  /**
   * Add alias to command
   */
  async addAlias(commandId: string, alias: string): Promise<CustomCommand> {
    const query = `
      UPDATE custom_commands 
      SET aliases = CASE 
        WHEN aliases @> $2::jsonb THEN aliases
        ELSE jsonb_insert(COALESCE(aliases, '[]'::jsonb), '{' || jsonb_array_length(COALESCE(aliases, '[]'::jsonb)) || '}', to_jsonb($3::text))
      END
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [commandId, JSON.stringify([alias.toLowerCase()]), alias.toLowerCase()]);
      return this.formatCommand(result.rows[0]);
    } catch (error) {
      logger.error('Failed to add alias', error);
      throw error;
    }
  }

  /**
   * Remove alias from command
   */
  async removeAlias(commandId: string, alias: string): Promise<CustomCommand> {
    const query = `
      UPDATE custom_commands 
      SET aliases = aliases - $2::text
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [commandId, alias.toLowerCase()]);
      return this.formatCommand(result.rows[0]);
    } catch (error) {
      logger.error('Failed to remove alias', error);
      throw error;
    }
  }

  /**
   * Get custom command config for guild
   */
  async getGuildConfig(guildId: string): Promise<any> {
    const query = `
      SELECT * FROM custom_commands_config 
      WHERE guild_id = $1
    `;

    try {
      const result = await this.pool.query(query, [guildId]);
      return result.rows[0] || this.getDefaultConfig(guildId);
    } catch (error) {
      logger.warn('Failed to get guild config, using defaults', error);
      return this.getDefaultConfig(guildId);
    }
  }

  /**
   * Update custom command config
   */
  async updateGuildConfig(guildId: string, config: any): Promise<any> {
    const query = `
      INSERT INTO custom_commands_config 
      (guild_id, enabled, prefix, max_commands, allow_slash)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (guild_id) DO UPDATE SET
        enabled = $2,
        prefix = $3,
        max_commands = $4,
        allow_slash = $5
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [
        guildId,
        config.enabled !== false,
        config.prefix || '!',
        config.maxCommands || 50,
        config.allowSlash !== false
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update guild config', error);
      throw error;
    }
  }

  /**
   * Get cooldown information
   */
  async getCooldown(guildId: string, commandId: string, userId: string): Promise<number> {
    const query = `
      SELECT cooldown_expires_at FROM command_cooldowns 
      WHERE guild_id = $1 AND command_id = $2 AND user_id = $3
    `;

    try {
      const result = await this.pool.query(query, [guildId, commandId, userId]);
      if (result.rows.length > 0) {
        const expiresAt = new Date(result.rows[0].cooldown_expires_at).getTime();
        const now = Date.now();
        return Math.max(0, expiresAt - now);
      }
      return 0;
    } catch (error) {
      logger.warn('Failed to get cooldown', error);
      return 0;
    }
  }

  /**
   * Set cooldown for a user
   */
  async setCooldown(guildId: string, commandId: string, userId: string, cooldownMs: number): Promise<void> {
    const expiresAt = new Date(Date.now() + cooldownMs);

    const query = `
      INSERT INTO command_cooldowns (guild_id, command_id, user_id, cooldown_expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (guild_id, command_id, user_id) DO UPDATE SET
        cooldown_expires_at = $4
    `;

    try {
      await this.pool.query(query, [guildId, commandId, userId, expiresAt]);
    } catch (error) {
      logger.warn('Failed to set cooldown', error);
    }
  }

  /**
   * Format database row to CustomCommand object
   */
  private formatCommand(row: any): CustomCommand {
    return {
      id: row.id,
      guildId: row.guildId,
      name: row.name,
      aliases: row.aliases || [],
      response: row.response,
      embedResponse: row.embed_response || false,
      requiredRoleId: row.required_role_id,
      cooldown: row.cooldown || 0,
      useCount: row.use_count || 0,
      createdBy: row.created_by,
      createdAt: row.createdAt,
      dm: row.dm || false,
      ephemeral: row.ephemeral || false,
      deleteInvocation: row.delete_invocation || false,
      addReaction: row.add_reaction,
      allowedChannels: row.allowed_channels || []
    };
  }

  /**
   * Get default config
   */
  private getDefaultConfig(guildId: string): any {
    return {
      guildId,
      enabled: true,
      prefix: '!',
      maxCommands: 50,
      allowSlash: true
    };
  }
}

export default CustomCommandsHelper;
