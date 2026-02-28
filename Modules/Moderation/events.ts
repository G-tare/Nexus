import { Client, Events, Message, GuildMember } from 'discord.js';
import { getRedis } from '../../Shared/src/database/connection';
import { getModConfig } from './helpers';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { eventBus } from '../../Shared/src/events/eventBus';
import { ModuleEvent } from '../../Shared/src/types/command';

const logger = createModuleLogger('Moderation:Events');

/**
 * Shadow Ban Handler
 * Deletes messages from shadowbanned users immediately.
 */
const shadowBanHandler: ModuleEvent = { event: Events.MessageCreate,
  async handler(message: Message) {
    if (!message.guild || message.author.bot) return;

    const redis = getRedis();
    const isShadowBanned = await redis.sismember(
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
        const { EmbedBuilder } = await import('discord.js');
        const { Colors } = require('../../Shared/src/utils/embed');

        const embed = new EmbedBuilder()
          .setColor(Colors.Warning)
          .setTitle('🔍 Alt Detection — Keyword Match')
          .addFields(
            { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
            { name: 'Keyword Matched', value: `"${matched}"` },
            { name: 'Message Content', value: message.content.slice(0, 1024) },
          )
          .setThumbnail(message.author.displayAvatarURL())
          .setTimestamp();

        await (logChannel as any).send({ embeds: [embed] });
      }
    } catch (err: any) {
      logger.error('Alt detection log failed', { error: err.message });
    }
  },
};

/**
 * Temp Ban Expiry Checker
 * Polls Redis for expired temp bans and unbans them.
 * This runs as a periodic check since Redis key expiry events aren't reliable.
 */
const tempBanChecker: ModuleEvent = { event: Events.ClientReady,
  once: true,
  async handler(client: Client) {
    // Check every 30 seconds for expired temp bans
    setInterval(async () => {
      const redis = getRedis();
      try {
        const keys = await redis.keys('tempban:*:*');
        for (const key of keys) {
          const ttl = await redis.ttl(key);
          if (ttl <= 0) {
            // Key expired, unban the user
            const parts = key.split(':');
            const guildId = parts[1];
            const userId = parts[2];

            const guild = client.guilds.cache.get(guildId);
            if (guild) {
              try {
                await guild.members.unban(userId, '[AUTO] Temporary ban expired');
                logger.info('Temp ban expired, user unbanned', { guildId, userId });
              } catch {
                // User might already be unbanned
              }
            }
            await redis.del(key);
          }
        }
      } catch (err: any) {
        logger.error('Temp ban check error', { error: err.message });
      }
    }, 30000);

    logger.info('Temp ban expiry checker started');
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
 */
const autoKickHandler: ModuleEvent = { event: Events.GuildMemberAdd,
  async handler(member: GuildMember) {
    if (member.user.bot) return;

    const redis = getRedis();
    const isAutoKicked = await redis.sismember(
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
  tempBanChecker,
  autoKickHandler,
];

export { setupWarnThresholdListener };
