import { Client, Events, Message, GuildMember } from 'discord.js';
import { getPool } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { timers } from '../../Shared/src/cache/timerManager';
import { getModConfig } from './helpers';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { eventBus } from '../../Shared/src/events/eventBus';
import { ModuleEvent } from '../../Shared/src/types/command';

const logger = createModuleLogger('Moderation:Events');

/**
 * Shadow Ban Handler
 * Deletes messages from shadowbanned users immediately.
 * Uses in-memory Set instead of Redis sismember.
 */
const shadowBanHandler: ModuleEvent = { event: Events.MessageCreate,
  async handler(message: Message) {
    if (!message.guild || message.author.bot) return;

    const isShadowBanned = cache.sismember(
      `shadowban:${message.guild.id}`,
      message.author.id
    );

    if (isShadowBanned) {
      try {
        await message.delete();
        logger.debug('Shadow ban: deleted message', {
          guild: message.guild.id,
          user: message.author.id,
        });
      } catch (err: any) {
        logger.error('Shadow ban: failed to delete message', { error: err.message });
      }
      // Don't let this message count for any tracking
      return;
    }
  },
};

/**
 * Alt Detection Chat Monitor
 * Scans messages for phrases indicating alt accounts.
 */
const altDetectionHandler: ModuleEvent = { event: Events.MessageCreate,
  async handler(message: Message) {
    if (!message.guild || message.author.bot) return;

    const config = await getModConfig(message.guild.id);
    if (!config.altDetectionEnabled || !config.altDetectionLogChannelId) return;

    const content = message.content.toLowerCase();
    const keywords = config.altDetectionKeywords || [];

    const matched = keywords.find(kw => content.includes(kw.toLowerCase()));
    if (!matched) return;

    // Log to alt detection channel
    try {
      const logChannel = await message.guild.channels.fetch(config.altDetectionLogChannelId);
      if (logChannel?.isTextBased()) {
        const { MessageFlags, ContainerBuilder, TextDisplayBuilder } = await import('discord.js');
        const { addSectionWithThumbnail, addFields, V2Colors } = await import('../../Shared/src/utils/componentsV2');

        const container = new ContainerBuilder().setAccentColor(V2Colors.Warning);
        addSectionWithThumbnail(
          container,
          '### 🔍 Alt Detection — Keyword Match',
          message.author.displayAvatarURL()
        );
        addFields(container, [
          { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Keyword Matched', value: `"${matched}"` },
          { name: 'Message Content', value: message.content.slice(0, 1024) },
        ]);

        await (logChannel as any).send({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }
    } catch (err: any) {
      logger.error('Alt detection log failed', { error: err.message });
    }
  },
};

/**
 * Temp Ban Expiry — TimerManager-based.
 *
 * On startup, loads all active tempbans from Postgres and schedules
 * a setTimeout for each. No polling, no Redis KEYS scan.
 * New tempbans are scheduled at creation time (see helpers.ts).
 */
const tempBanLoader: ModuleEvent = { event: Events.ClientReady,
  once: true,
  async handler(client: Client) {
    const pool = getPool();

    await timers.loadFromSource(
      'tempban',
      async () => {
        // Query all active tempbans from Postgres
        const result = await pool.query(
          `SELECT guild_id, user_id, expires_at FROM temp_bans
           WHERE expires_at > NOW()`,
        );
        return result.rows.map((row: { guild_id: string; user_id: string; expires_at: string }) => ({
          id: `tempban:${row.guild_id}:${row.user_id}`,
          executeAt: new Date(row.expires_at),
        }));
      },
      (id: string) => {
        const parts = id.split(':');
        const guildId = parts[1];
        const userId = parts[2];

        return async () => {
          const guild = client.guilds.cache.get(guildId);
          if (guild) {
            try {
              await guild.members.unban(userId, '[AUTO] Temporary ban expired');
              logger.info('Temp ban expired, user unbanned', { guildId, userId });
            } catch {
              // User might already be unbanned
            }
          }
          // Clean up the DB record
          await pool.query(
            'DELETE FROM temp_bans WHERE guild_id = $1 AND user_id = $2',
            [guildId, userId],
          ).catch(() => null);
        };
      },
    );

    logger.info('Temp ban expiry system ready (timer-based, no polling)');
  },
};

/**
 * Warning Threshold Auto-Escalation
 * Listens for warnThresholdReached events and takes action.
 */
function setupWarnThresholdListener(client: Client) {
  eventBus.on('warnThresholdReached', async ({ guildId, userId, warnCount, threshold, action }) => {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const botMember = guild.members.me;
    if (!botMember) return;

    try {
      switch (action) {
        case 'mute': {
          const config = await getModConfig(guildId);
          const muteDuration = 60 * 60 * 1000; // 1 hour default
          await member.timeout(muteDuration, `[AUTO] Warning threshold reached (${warnCount}/${threshold} warnings)`);
          logger.info('Auto-mute from warn threshold', { guildId, userId, warnCount, threshold });
          break;
        }
        case 'kick': {
          await member.kick(`[AUTO] Warning threshold reached (${warnCount}/${threshold} warnings)`);
          logger.info('Auto-kick from warn threshold', { guildId, userId, warnCount, threshold });
          break;
        }
        case 'ban': {
          await guild.members.ban(userId, {
            reason: `[AUTO] Warning threshold reached (${warnCount}/${threshold} warnings)`,
          });
          logger.info('Auto-ban from warn threshold', { guildId, userId, warnCount, threshold });
          break;
        }
      }
    } catch (err: any) {
      logger.error('Warn threshold auto-action failed', { error: err.message, guildId, userId, action });
    }
  });
}

/**
 * Auto-Kick Handler
 * Kicks users on the auto-kick list every time they rejoin.
 * Uses in-memory Set instead of Redis sismember.
 */
const autoKickHandler: ModuleEvent = { event: Events.GuildMemberAdd,
  async handler(member: GuildMember) {
    if (member.user.bot) return;

    const isAutoKicked = cache.sismember(
      `autokick:${member.guild.id}`,
      member.id
    );

    if (isAutoKicked) {
      try {
        await member.kick('[AUTO] User is on auto-kick list');
        logger.info('Auto-kick: kicked rejoining user', {
          guild: member.guild.id,
          user: member.id,
        });
      } catch (err: any) {
        logger.error('Auto-kick: failed to kick user', { error: err.message });
      }
    }
  },
};

export const moderationEvents: ModuleEvent[] = [
  shadowBanHandler,
  altDetectionHandler,
  tempBanLoader,
  autoKickHandler,
];

export { setupWarnThresholdListener };
