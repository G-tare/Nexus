import { Client, Events, Message, VoiceState, EmbedBuilder, TextChannel, ChannelType } from 'discord.js';
import { getRedis, getDb } from '../../Shared/src/database/connection';
import { guildMembers } from '../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  getLevelingConfig,
  randomXp,
  getXpMultiplier,
  shouldEarnXp,
  grantXp,
  assignLevelRoles,
  levelFromTotalXp,
} from './helpers';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { eventBus } from '../../Shared/src/events/eventBus';
import { ModuleEvent } from '../../Shared/src/types/command';
import { Colors } from '../../Shared/src/utils/embed';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';

const logger = createModuleLogger('Leveling:Events');

// ============================================
// Message XP Handler
// ============================================

const messageXpHandler: ModuleEvent = { event: Events.MessageCreate,
  handler: async (message: Message) => {
    // Skip bots and DMs
    if (message.author.bot || !message.guildId || !message.guild) return;

    try {
      const guildId = message.guildId!;
      const userId = message.author.id;
      const channelId = message.channelId;

      // Always increment total message count and update last_message_at for dashboard stats
      try {
        const db = getDb();
        await db.update(guildMembers)
          .set({
            totalMessages: sql`${guildMembers.totalMessages} + 1`,
            lastMessageAt: new Date(),
          })
          .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)));
      } catch {
        // Non-critical — don't block XP flow if stats update fails
      }

      // Get leveling config for guild
      const config = await getLevelingConfig(guildId);

      // Check if member should earn XP
      const memberRoleIds = message.member?.roles.cache.map(r => r.id) || [];
      if (!shouldEarnXp(memberRoleIds, channelId, config)) {
        return;
      }

      // Check cooldown in Redis
      const redis = getRedis();
      const cooldownKey = `xpcd:${guildId}:${userId}`;
      const cooldownExists = await redis.exists(cooldownKey);

      if (cooldownExists) {
        return;
      }

      // Set cooldown
      await redis.setex(cooldownKey, config.xpCooldownSeconds, '1');

      // Calculate XP
      const baseXp = randomXp(config);
      const multiplier = getXpMultiplier(message.member!, config, message.member?.user ? 0 : undefined);
      const xpToGrant = Math.floor(baseXp * multiplier);

      // Grant XP
      const result = await grantXp(guildId, userId, xpToGrant, 'message');
      if (!result) return;

      // Handle level-up
      if (result.leveledUp) {
        const { oldLevel, newLevel } = result;

        // Assign level roles
        if (message.member) {
          try {
            await assignLevelRoles(message.member, newLevel, config);
          } catch (err: any) {
            logger.error('Failed to assign level roles', { error: err.message });
          }
        }

        // Send announcement
        const announceMessage = config.announceMessage
          .replace('{user}', message.author.toString())
          .replace('{level}', newLevel.toString())
          .replace('{role}', 'Member'); // TODO: Replace with actual role name if levelRoles include one

        const embed = new EmbedBuilder()
          .setColor(Colors.Leveling)
          .setTitle('Level Up!')
          .setDescription(announceMessage)
          .setThumbnail(message.author.displayAvatarURL())
          .addFields(
            { name: 'Level', value: `${oldLevel} → ${newLevel}`, inline: true },
            { name: 'Total XP', value: result.totalXp.toLocaleString(), inline: true }
          )
          .setTimestamp();

        switch (config.announceType) {
          case 'current':
            // Reply in same channel
            try {
              await message.reply({ embeds: [embed] });
            } catch (err: any) {
              logger.warn('Failed to send level-up message in channel', { error: err.message });
            }
            break;

          case 'channel':
            // Send to configured announcement channel
            if (config.announceChannelId) {
              try {
                const channel = await message.guild!.channels.fetch(config.announceChannelId);
                if (channel && channel.type === ChannelType.GuildText) {
                  await (channel as TextChannel).send({ embeds: [embed] });
                }
              } catch (err: any) {
                logger.warn('Failed to send level-up to announcement channel', { error: err.message });
              }
            }
            break;

          case 'dm':
            // DM the user
            try {
              await message.author.send({ embeds: [embed] });
            } catch (err: any) {
              logger.warn('Failed to DM level-up message', { error: err.message });
            }
            break;

          case 'off':
            // No announcement
            break;
        }

        // Emit level-up event
        eventBus.emit('levelUp', { guildId, userId, oldLevel, newLevel });
      }

      // Emit XP gain event
      eventBus.emit('xpGain', { guildId, userId, amount: xpToGrant, source: 'message' });
    } catch (error: any) {
      logger.error('Message XP handler error', { error: (error as any).message });
    }
  }
};

// ============================================
// Voice XP Handler
// ============================================

const voiceXpHandler: ModuleEvent = { event: Events.VoiceStateUpdate,
  handler: async (oldState: VoiceState, newState: VoiceState) => {
    const guildId = newState.guild.id;
    const userId = newState.id;

    if (!guildId || !userId) return;

    try {
      const redis = getRedis();
      const joinKey = `voicejoin:${guildId}:${userId}`;

      // User joined a voice channel
      if (!oldState.channel && newState.channel) {
        await redis.setex(joinKey, 24 * 60 * 60, Date.now().toString()); // 24h max session
        return;
      }

      // User left or switched channels
      if (oldState.channel && (!newState.channel || oldState.channelId !== newState.channelId)) {
        const joinTimeStr = await redis.getdel(joinKey);
        if (!joinTimeStr) return;

        const joinTime = parseInt(joinTimeStr);
        const timeSpentMs = Date.now() - joinTime;
        const timeSpentMinutes = Math.max(1, Math.floor(timeSpentMs / 60000)); // At least 1 minute

        // Get config
        const config = await getLevelingConfig(guildId);

        // Check if user was muted/deafened and config requires unmuted
        if (config.voiceRequireUnmuted && (oldState.mute || oldState.deaf || oldState.selfMute || oldState.selfDeaf)) {
          return;
        }

        // Get member data
        const member = newState.member || oldState.member;
        if (!member) return;

        // Check if member should earn XP
        const memberRoleIds = member.roles.cache.map(r => r.id);
        if (!shouldEarnXp(memberRoleIds, oldState.channelId!, config)) {
          return;
        }

        // Calculate XP
        const baseXp = timeSpentMinutes * config.xpPerVoiceMinute;
        const multiplier = getXpMultiplier(member, config, 0);
        const xpToGrant = Math.floor(baseXp * multiplier);

        // Grant XP
        const result = await grantXp(guildId, userId, xpToGrant, 'voice');
        if (!result) return;

        // Handle level-up
        if (result.leveledUp) {
          const { oldLevel, newLevel } = result;

          // Assign level roles
          try {
            await assignLevelRoles(member, newLevel, config);
          } catch (err: any) {
            logger.error('Failed to assign level roles', { error: err.message });
          }

          // Send announcement
          const announceMessage = config.announceMessage
            .replace('{user}', member.user.toString())
            .replace('{level}', newLevel.toString())
            .replace('{role}', 'Member');

          const embed = new EmbedBuilder()
            .setColor(Colors.Leveling)
            .setTitle('Level Up!')
            .setDescription(announceMessage)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
              { name: 'Level', value: `${oldLevel} → ${newLevel}`, inline: true },
              { name: 'Total XP', value: result.totalXp.toLocaleString(), inline: true }
            )
            .setTimestamp();

          switch (config.announceType) {
            case 'current':
              // Use voice channel if still valid
              if (oldState.channel) {
                try {
                  await (oldState.channel as any).send({ embeds: [embed] });
                } catch (err: any) {
                  logger.warn('Failed to send level-up to voice channel', { error: err.message });
                }
              }
              break;

            case 'channel':
              if (config.announceChannelId) {
                try {
                  const channel = await newState.guild.channels.fetch(config.announceChannelId);
                  if (channel && channel.type === ChannelType.GuildText) {
                    await (channel as TextChannel).send({ embeds: [embed] });
                  }
                } catch (err: any) {
                  logger.warn('Failed to send level-up to announcement channel', { error: err.message });
                }
              }
              break;

            case 'dm':
              try {
                await member.user.send({ embeds: [embed] });
              } catch (err: any) {
                logger.warn('Failed to DM level-up message', { error: err.message });
              }
              break;

            case 'off':
              break;
          }

          // Emit event
          eventBus.emit('levelUp', { guildId, userId, oldLevel, newLevel });
        }

        // Emit XP gain event
        eventBus.emit('xpGain', { guildId, userId, amount: xpToGrant, source: 'voice' });
      }
    } catch (error: any) {
      logger.error('Voice XP handler error', { error: (error as any).message });
    }
  }
};

// ============================================
// Double XP Expiry Checker
// ============================================

const doubleXpExpiryChecker: ModuleEvent = { event: Events.ClientReady,
  once: true,
  handler: async (client: Client) => {
    logger.info('Starting double XP expiry checker');

    // Run every 60 seconds
    setInterval(async () => {
      try {
        // Get all guilds and check their configs
        const guilds = client.guilds.cache.map(g => g.id);

        for (const guildId of guilds) {
          const config = await getLevelingConfig(guildId);

          // Check if double XP is active and expired
          if (config.doubleXpActive && config.doubleXpExpiresAt) {
            const expiresAt = new Date(config.doubleXpExpiresAt);
            if (expiresAt <= new Date()) {
              // Disable double XP
              await moduleConfig.setConfig(guildId, 'leveling', {
                ...config,
                doubleXpActive: false,
                doubleXpExpiresAt: undefined,
              });

              logger.info('Disabled expired double XP event', { guildId });

              // Notify guild (optional)
              const guild = await client.guilds.fetch(guildId).catch(() => null);
              if (guild) {
                const systemChannel = guild.systemChannel;
                if (systemChannel) {
                  const embed = new EmbedBuilder()
                    .setColor(Colors.Warning)
                    .setTitle('Double XP Event Ended')
                    .setDescription('The double XP event has expired.')
                    .setTimestamp();

                  try {
                    await systemChannel.send({ embeds: [embed] });
                  } catch (err: any) {
                    logger.warn('Failed to notify guild of expired double XP', { error: err.message });
                  }
                }
              }
            }
          }
        }
      } catch (error: any) {
        logger.error('Double XP expiry checker error', { error: (error as any).message });
      }
    }, 60 * 1000); // 60 seconds
  }
};

// ============================================
// Export Events Array
// ============================================

export const levelingEvents: ModuleEvent[] = [
  messageXpHandler,
  voiceXpHandler,
  doubleXpExpiryChecker,
];
