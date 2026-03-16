import {
  Client,
  Events,
  Message,
  GuildMember,
  AuditLogEvent,
  TextChannel,
  PermissionFlagsBits,
  BaseGuildTextChannel,
  Role,
  GuildBan,
} from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import {
  getAutomodConfig,
  isExempt,
  checkSpamRate,
  checkDuplicates,
  checkEmojis,
  checkCaps,
  checkMentions,
  checkLinks,
  checkInvites,
  checkWordFilter,
  incrementOffense,
  getEscalatedAction,
  executeAction,
  logAutomodAction,
  AutomodConfig,
} from './helpers';
import { cache } from '../../Shared/src/cache/cacheManager';
import { timers } from '../../Shared/src/cache/timerManager';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Automod:Events');

const WARNING_DELETE_TIMEOUT = 5000;
const UNLOCK_CHECK_INTERVAL = 30000;

/**
 * Message filter handler - checks for spam, links, invites, caps, mentions, emojis, and word filters
 */
const messageFilterHandler: ModuleEvent = { event: Events.MessageCreate,
  once: false,
  async handler(message: Message) {
    if (message.author.bot || !message.guild) return;
    if (!message.content || message.content.trim().length === 0) return;

    try {
      const config = await getAutomodConfig(message.guild.id);
      if (!config.antispam.enabled && !config.antilink.enabled && !config.antiinvite.enabled && !config.wordfilter.enabled) {
        return;
      }

      if (!message.member) return;
      if (isExempt(message.member, config, message.channelId)) return;

      // Run checks
      let violationReason: string | null = null;
      let violationType: string | null = null;

      // Word filter
      if (!violationReason && config.wordfilter.enabled) {
        const result = checkWordFilter(message.content, config.wordfilter);
        if (result.matched) {
          violationReason = `Word filter triggered: ${result.trigger}`;
          violationType = 'word_filter';
        }
      }

      // Anti-invite
      if (!violationReason && config.antiinvite.enabled) {
        if (checkInvites(message.content)) {
          violationReason = 'Discord invite link detected';
          violationType = 'anti_invite';
        }
      }

      // Anti-link
      if (!violationReason && config.antilink.enabled) {
        if (checkLinks(message.content, config.antilink)) {
          violationReason = 'Disallowed link detected';
          violationType = 'anti_link';
        }
      }

      // Spam rate
      if (!violationReason && config.antispam.enabled) {
        if (await checkSpamRate(message.guild.id, message.author.id, config)) {
          violationReason = 'Message spam rate exceeded';
          violationType = 'spam_rate';
        }
      }

      // Duplicate messages
      if (!violationReason && config.antispam.enabled) {
        if (await checkDuplicates(message.guild.id, message.author.id, message.content, config)) {
          violationReason = 'Duplicate message spam';
          violationType = 'spam_duplicates';
        }
      }

      // Emoji spam (requires both the toggle AND a threshold > 0)
      if (!violationReason && config.antispam.emojiEnabled && config.antispam.maxEmojis > 0) {
        if (checkEmojis(message.content, config.antispam.maxEmojis)) {
          violationReason = 'Too many emojis';
          violationType = 'emoji_spam';
        }
      }

      // Caps spam (requires both the toggle AND a threshold > 0)
      if (!violationReason && config.antispam.capsEnabled && config.antispam.maxCaps > 0) {
        if (checkCaps(message.content, config.antispam.maxCaps, config.antispam.minMessageLength)) {
          violationReason = 'Excessive capital letters';
          violationType = 'caps_spam';
        }
      }

      // Mention spam (requires both the toggle AND a threshold > 0)
      if (!violationReason && config.antispam.mentionEnabled && config.antispam.maxMentions > 0) {
        if (checkMentions(message, config.antispam.maxMentions)) {
          violationReason = 'Too many mentions';
          violationType = 'mention_spam';
        }
      }

      if (!violationReason || !violationType) return;

      // Violation detected - delete the message
      try {
        await message.delete().catch(() => {});
      } catch (error) {
        logger.error('Error deleting message:', error);
      }

      try {
        // Increment offense and get escalated action
        const offenseCount = await incrementOffense(message.guild.id, message.author.id);
        const action = getEscalatedAction(offenseCount, config);

        // Execute the action on the message
        await executeAction(action, message, `Automod: ${violationReason}`);

        // Log to automod log channel + database
        await logAutomodAction(
          message.guild,
          config,
          message.author.id,
          action.type,
          violationReason,
          `Violation type: ${violationType}`,
          {
            violationType,
            channelId: message.channel.id,
            messageContent: message.content,
            duration: 'duration' in action ? action.duration : undefined,
          }
        );

        // Send warning message (auto-delete after 5s)
        const warningMsg = await (message.channel as TextChannel)
          .send({
            content: `⚠️ ${message.author}, your message was removed (${violationType}). Please review the rules.`,
          })
          .catch(() => null);

        if (warningMsg) {
          setTimeout(() => {
            warningMsg.delete().catch(() => {});
          }, WARNING_DELETE_TIMEOUT);
        }
      } catch (error) {
        logger.error('Error handling automod violation:', error);
      }
    } catch (error) {
      logger.error('Error in messageFilterHandler:', error);
    }
  },
};

/**
 * Raid detection handler - monitors account age and join rate
 */
const raidDetectionHandler: ModuleEvent = { event: Events.GuildMemberAdd,
  once: false,
  async handler(member: GuildMember) {
    try {
      const config = await getAutomodConfig(member.guild.id);
      if (!config.antiraid.enabled) return;

      const now = Date.now();
      const accountAgeMs = now - member.user.createdTimestamp;
      const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

      // Check account age
      if (accountAgeDays < config.antiraid.minAccountAgeDays) {
        try {
          const reason = `Account too young (${accountAgeDays.toFixed(1)} days old)`;
          await member.kick(reason);

          await logAutomodAction(
            member.guild,
            config,
            member.id,
            'kick',
            reason,
            'Raid detection: account age'
          );
        } catch (error) {
          logger.error(`Failed to kick young account ${member.id}:`, error);
        }
        return;
      }

      // Track join rate (in-memory sorted set)
      const joinKey = `automod:joins:${member.guild.id}`;
      const timeframeMs = config.antiraid.timeframeSeconds * 1000;
      const cutoffTime = now - timeframeMs;

      try {
        cache.zadd(joinKey, now, member.id);
        cache.zremrangebyscore(joinKey, 0, cutoffTime);
        const joinCount = cache.zcard(joinKey);
        cache.expire(joinKey, Math.ceil(config.antiraid.timeframeSeconds * 2));

        if (joinCount >= config.antiraid.joinThreshold) {
          const action = config.antiraid.action;
          logger.warn(`RAID DETECTED in ${member.guild.id}: ${joinCount} joins in ${config.antiraid.timeframeSeconds}s`);

          try {
            if (action === 'kick') {
              await member.kick('Raid detection - rapid join rate');
            } else if (action === 'ban') {
              await member.ban({ reason: 'Raid detection - rapid join rate' });
            } else if (action === 'lockdown') {
              const channels = member.guild.channels.cache.filter(
                (ch) => ch.isTextBased() && !ch.isDMBased()
              );

              const lockedChannelIds: string[] = [];

              for (const [, channel] of channels) {
                try {
                  const textChannel = channel as BaseGuildTextChannel;
                  const everyoneOverride = textChannel.permissionOverwrites.cache.get(
                    member.guild.roles.everyone.id
                  );
                  if (everyoneOverride?.deny.has(PermissionFlagsBits.SendMessages)) {
                    continue;
                  }
                  await textChannel.permissionOverwrites.edit(
                    member.guild.roles.everyone,
                    { SendMessages: false },
                    { reason: 'Raid detection - lockdown activated' }
                  );
                  lockedChannelIds.push(channel.id);
                } catch (error) {
                  logger.error(`Failed to lock channel ${channel.id}:`, error);
                }
              }

              const lockdownKey = `automod:lockdown:${member.guild.id}`;
              const lockedChannelsKey = `automod:lockdown:channels:${member.guild.id}`;
              const lockdownDuration = config.antiraid.lockdownDurationMinutes * 60;

              // Store lockdown state in cache with TTL
              cache.set(lockdownKey, { lockedAt: now }, lockdownDuration);
              cache.set(lockedChannelsKey, lockedChannelIds, lockdownDuration + 120);

              // Schedule auto-unlock using TimerManager
              const unlockAt = new Date(now + lockdownDuration * 1000);
              const guild = member.guild;
              timers.schedule(`lockdown:${guild.id}`, unlockAt, async () => {
                try {
                  for (const channelId of lockedChannelIds) {
                    try {
                      const ch = guild.channels.cache.get(channelId);
                      if (!ch || !ch.isTextBased() || ch.isDMBased()) continue;

                      const textCh = ch as BaseGuildTextChannel;
                      const override = textCh.permissionOverwrites.cache.get(
                        guild.roles.everyone.id
                      );

                      if (override?.deny.has(PermissionFlagsBits.SendMessages)) {
                        await textCh.permissionOverwrites.edit(
                          guild.roles.everyone,
                          { SendMessages: null },
                          { reason: 'Raid lockdown expired — restoring channel' }
                        );
                      }
                    } catch (err) {
                      logger.error(`Failed to unlock channel ${channelId}:`, err);
                    }
                  }

                  cache.del(lockedChannelsKey);
                  logger.info(`Unlocked ${lockedChannelIds.length} channels in guild ${guild.id} after raid lockdown expiry`);
                } catch (err) {
                  logger.error(`Error in lockdown unlock timer for guild ${guild.id}:`, err);
                }
              });
            }

            await logAutomodAction(
              member.guild,
              config,
              member.id,
              action,
              `${joinCount} joins in ${config.antiraid.timeframeSeconds}s`,
              'Raid detection: join rate'
            );
          } catch (error) {
            logger.error('Error executing raid action:', error);
          }
        }
      } catch (error) {
        logger.error('Error tracking join rate:', error);
      }
    } catch (error) {
      logger.error('Error in raidDetectionHandler:', error);
    }
  },
};

/**
 * Anti-nuke handler - channel deletions
 */
const antiNukeChannelHandler: ModuleEvent = { event: Events.ChannelDelete,
  once: false,
  async handler(channel: BaseGuildTextChannel) {
    if (!channel?.guild) return;

    try {
      const config = await getAutomodConfig(channel.guild.id);
      if (!config.antinuke.enabled) return;

      const counterKey = `automod:nuke:channelDelete:${channel.guild.id}`;
      const timeframeMs = 60000;

      try {
        const count = cache.pincr(counterKey, timeframeMs);

        if (count >= config.antinuke.maxChannelDeletesPerMinute) {
          let deleter: GuildMember | null = null;
          try {
            const auditLog = await channel.guild.fetchAuditLogs({
              type: AuditLogEvent.ChannelDelete,
              limit: 1,
            });
            const entry = auditLog.entries.first();
            if (entry && entry.executor) {
              deleter = await channel.guild.members.fetch(entry.executor.id).catch(() => null);
            }
          } catch (error) {
            logger.warn('Failed to fetch audit logs:', error);
          }

          if (deleter) {
            try {
              const reason = `Anti-nuke: ${count} channel deletions in 1 minute`;
              // Execute anti-nuke action on the deleter
              if (config.antinuke.action === 'ban' && deleter.bannable) {
                await deleter.ban({ reason });
              } else if (config.antinuke.action === 'kick' && deleter.kickable) {
                await deleter.kick(reason);
              } else if (config.antinuke.action === 'strip') {
                await deleter.roles.set([], reason);
              }

              await logAutomodAction(
                channel.guild,
                config,
                deleter.id,
                config.antinuke.action,
                reason,
                'Anti-nuke: channel deletion'
              );
            } catch (error) {
              logger.error('Error executing nuke action:', error);
            }
          }
        }
      } catch (error) {
        logger.error('Error handling channel delete:', error);
      }
    } catch (error) {
      logger.error('Error in antiNukeChannelHandler:', error);
    }
  },
};

/**
 * Anti-nuke handler - role deletions
 */
const antiNukeRoleHandler: ModuleEvent = { event: Events.GuildRoleDelete,
  once: false,
  async handler(role: Role) {
    try {
      const config = await getAutomodConfig(role.guild.id);
      if (!config.antinuke.enabled) return;

      const counterKey = `automod:nuke:roleDelete:${role.guild.id}`;
      const timeframeMs = 60000;

      try {
        const count = cache.pincr(counterKey, timeframeMs);

        if (count >= config.antinuke.maxRoleDeletesPerMinute) {
          let deleter: GuildMember | null = null;
          try {
            const auditLog = await role.guild.fetchAuditLogs({
              type: AuditLogEvent.RoleDelete,
              limit: 1,
            });
            const entry = auditLog.entries.first();
            if (entry && entry.executor) {
              deleter = await role.guild.members.fetch(entry.executor.id).catch(() => null);
            }
          } catch (error) {
            logger.warn('Failed to fetch audit logs:', error);
          }

          if (deleter) {
            try {
              const reason = `Anti-nuke: ${count} role deletions in 1 minute`;
              if (config.antinuke.action === 'ban' && deleter.bannable) {
                await deleter.ban({ reason });
              } else if (config.antinuke.action === 'kick' && deleter.kickable) {
                await deleter.kick(reason);
              } else if (config.antinuke.action === 'strip') {
                await deleter.roles.set([], reason);
              }

              await logAutomodAction(
                role.guild,
                config,
                deleter.id,
                config.antinuke.action,
                reason,
                'Anti-nuke: role deletion'
              );
            } catch (error) {
              logger.error('Error executing nuke action:', error);
            }
          }
        }
      } catch (error) {
        logger.error('Error handling role delete:', error);
      }
    } catch (error) {
      logger.error('Error in antiNukeRoleHandler:', error);
    }
  },
};

/**
 * Anti-nuke handler - mass bans
 */
const antiNukeBanHandler: ModuleEvent = { event: Events.GuildBanAdd,
  once: false,
  async handler(ban: GuildBan) {
    try {
      const config = await getAutomodConfig(ban.guild.id);
      if (!config.antinuke.enabled) return;

      const counterKey = `automod:nuke:banAdd:${ban.guild.id}`;
      const timeframeMs = 60000;

      try {
        const count = cache.pincr(counterKey, timeframeMs);

        if (count >= config.antinuke.maxBansPerMinute) {
          let banner: GuildMember | null = null;
          try {
            const auditLog = await ban.guild.fetchAuditLogs({
              type: AuditLogEvent.MemberBanAdd,
              limit: 1,
            });
            const entry = auditLog.entries.first();
            if (entry && entry.executor) {
              banner = await ban.guild.members.fetch(entry.executor.id).catch(() => null);
            }
          } catch (error) {
            logger.warn('Failed to fetch audit logs:', error);
          }

          if (banner) {
            try {
              const reason = `Anti-nuke: ${count} bans in 1 minute`;
              if (config.antinuke.action === 'ban' && banner.bannable) {
                await banner.ban({ reason });
              } else if (config.antinuke.action === 'kick' && banner.kickable) {
                await banner.kick(reason);
              } else if (config.antinuke.action === 'strip') {
                await banner.roles.set([], reason);
              }

              await logAutomodAction(
                ban.guild,
                config,
                banner.id,
                config.antinuke.action,
                reason,
                'Anti-nuke: mass ban'
              );
            } catch (error) {
              logger.error('Error executing nuke action:', error);
            }
          }
        }
      } catch (error) {
        logger.error('Error handling ban add:', error);
      }
    } catch (error) {
      logger.error('Error in antiNukeBanHandler:', error);
    }
  },
};

/**
 * Ready handler — lockdown expiry is now handled by TimerManager (scheduled when lockdown is created).
 * No polling needed.
 */
const automodReadyHandler: ModuleEvent = { event: Events.ClientReady,
  once: true,
  async handler(client: Client) {
    logger.info('Automod ready — lockdown expiry uses TimerManager (no polling)');
  },
};

export const automodEvents: ModuleEvent[] = [
  messageFilterHandler,
  raidDetectionHandler,
  antiNukeChannelHandler,
  antiNukeRoleHandler,
  antiNukeBanHandler,
  automodReadyHandler,
];
