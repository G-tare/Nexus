import { Events, GuildMember, AuditLogEvent } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  getAntiRaidConfig,
  checkRaidCondition,
  recordJoin,
  recordAction,
  checkMassAction,
  triggerLockdown,
  isInLockdown,
  sendRaidAlert,
  sendVerification,
  quarantineMember,
  storeAccountAge,
  logRaidAction,
} from './helpers';

const logger = createModuleLogger('AntiRaid');

const onGuildMemberAdd: ModuleEvent = { event: Events.GuildMemberAdd,
  handler: async (member: GuildMember) => {
    const config = await getAntiRaidConfig(member.guild.id);
    if (!config.enabled) return;

    try {
      const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60));
      const joinTimestamp = Math.floor(Date.now() / 1000);

      await storeAccountAge(member.guild.id, member.id, joinTimestamp);
      await recordJoin(member.guild.id, member.id, accountAge);

      const raidCheck = await checkRaidCondition(member.guild.id);

      if (raidCheck.isRaid) {
        logger.warn(`Raid detected in guild ${member.guild.id}: ${raidCheck.joinCount} joins, ${raidCheck.newAccountCount} new accounts`);

        await logRaidAction(member.guild, 'RAID_DETECTED', {
          joinCount: raidCheck.joinCount,
          newAccountCount: raidCheck.newAccountCount,
          triggeredBy: member.id,
        });

        if (config.action === 'kick') {
          await member.kick('AntiRaid: Join velocity threshold exceeded').catch((error) => {
            logger.warn(`Failed to kick member ${member.id}:`, error);
          });
        } else if (config.action === 'ban') {
          await member.ban({ reason: 'AntiRaid: Join velocity threshold exceeded' }).catch((error) => {
            logger.warn(`Failed to ban member ${member.id}:`, error);
          });
        } else if (config.action === 'quarantine') {
          await quarantineMember(member, 'Join velocity threshold exceeded');
        } else if (config.action === 'alert') {
          await sendRaidAlert(member.guild, {
            action: 'RAID_DETECTED',
            joinCount: raidCheck.joinCount,
            newAccountCount: raidCheck.newAccountCount,
            reason: 'Join velocity threshold exceeded',
          });
        }

        // Trigger auto-lockdown if enabled
        if (config.autoLockdown && !(await isInLockdown(member.guild.id))) {
          await triggerLockdown(member.guild, config.lockdownDuration);
        }
      }

      // Check account age
      if (accountAge < config.minAccountAge && !config.whitelistedRoles.some((id) => member.roles.cache.has(id))) {
        logger.info(`Member ${member.id} has new account (${accountAge}h old) in guild ${member.guild.id}`);
        if (config.action === 'quarantine') {
          await quarantineMember(member, `New account (${accountAge}h old)`);
        }
      }

      // Send verification if enabled
      if (config.verificationEnabled) {
        await sendVerification(member);
      }
    } catch (error) {
      logger.error(`Error in GuildMemberAdd handler:`, error);
    }
  },
};

const onGuildBanAdd: ModuleEvent = { event: Events.GuildBanAdd,
  handler: async (ban) => {
    const config = await getAntiRaidConfig(ban.guild.id);
    if (!config.enabled) return;

    try {
      await recordAction(ban.guild.id, ban.user.id, 'ban');

      const massActionCheck = await checkMassAction(ban.guild.id, ban.user.id);
      if (massActionCheck.isMassAction) {
        logger.warn(`Mass ban action detected in guild ${ban.guild.id}: ${massActionCheck.actionCount} bans`);

        await logRaidAction(ban.guild, 'MASS_BAN_DETECTED', { actionCount: massActionCheck.actionCount, triggeredBy: ban.user.id });
        await sendRaidAlert(ban.guild, { action: 'MASS_BAN_DETECTED', actionCount: massActionCheck.actionCount, reason: 'Multiple bans detected in short timeframe' });
      }
    } catch (error) {
      logger.error(`Error in GuildBanAdd handler:`, error);
    }
  },
};

const onGuildMemberRemove: ModuleEvent = { event: Events.GuildMemberRemove,
  handler: async (member: GuildMember) => {
    const config = await getAntiRaidConfig(member.guild.id);
    if (!config.enabled) return;

    try {
      const auditLogs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 }).catch(() => null);

      if (auditLogs) {
        const recentKick = auditLogs.entries.find((entry) => entry.targetId === member.id && Date.now() - entry.createdTimestamp < 5000);

        if (recentKick) {
          await recordAction(member.guild.id, member.id, 'kick');

          const massActionCheck = await checkMassAction(member.guild.id, member.id);
          if (massActionCheck.isMassAction) {
            logger.warn(`Mass kick action detected in guild ${member.guild.id}: ${massActionCheck.actionCount} kicks`);
            await logRaidAction(member.guild, 'MASS_KICK_DETECTED', { actionCount: massActionCheck.actionCount });
            await sendRaidAlert(member.guild, { action: 'MASS_KICK_DETECTED', actionCount: massActionCheck.actionCount, reason: 'Multiple kicks detected in short timeframe' });
          }
        }
      }
    } catch (error) {
      logger.error(`Error in GuildMemberRemove handler:`, error);
    }
  },
};

const onRoleDelete: ModuleEvent = { event: Events.GuildRoleDelete,
  handler: async (role) => {
    const config = await getAntiRaidConfig(role.guild.id);
    if (!config.enabled) return;

    try {
      const auditLogs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 5 }).catch(() => null);

      if (auditLogs) {
        const recentDelete = auditLogs.entries.find((entry: any) => entry.targetId === role.id && Date.now() - entry.createdTimestamp < 5000);

        if (recentDelete?.executor) {
          await recordAction(role.guild.id, recentDelete.executor.id, 'role_delete');

          const massActionCheck = await checkMassAction(role.guild.id, recentDelete.executor.id);
          if (massActionCheck.isMassAction) {
            logger.warn(`Mass role delete detected in guild ${role.guild.id}: ${massActionCheck.actionCount} deletes`);
            await logRaidAction(role.guild, 'MASS_ROLE_DELETE_DETECTED', { actionCount: massActionCheck.actionCount, executor: recentDelete.executor.id });
            await sendRaidAlert(role.guild, { action: 'MASS_ROLE_DELETE_DETECTED', actionCount: massActionCheck.actionCount, reason: 'Multiple role deletions detected' });
          }
        }
      }
    } catch (error) {
      logger.error(`Error in RoleDelete handler:`, error);
    }
  },
};

const onChannelDelete: ModuleEvent = { event: Events.ChannelDelete,
  handler: async (channel) => {
    if (!channel.guild) return;

    const config = await getAntiRaidConfig(channel.guild.id);
    if (!config.enabled) return;

    try {
      const auditLogs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 5 }).catch(() => null);

      if (auditLogs) {
        const recentDelete = auditLogs.entries.find((entry: any) => entry.targetId === channel.id && Date.now() - entry.createdTimestamp < 5000);

        if (recentDelete?.executor) {
          await recordAction(channel.guild.id, recentDelete.executor.id, 'channel_delete');

          const massActionCheck = await checkMassAction(channel.guild.id, recentDelete.executor.id);
          if (massActionCheck.isMassAction) {
            logger.warn(`Mass channel delete detected in guild ${channel.guild.id}: ${massActionCheck.actionCount} deletes`);
            await logRaidAction(channel.guild, 'MASS_CHANNEL_DELETE_DETECTED', { actionCount: massActionCheck.actionCount, executor: recentDelete.executor.id });
            await sendRaidAlert(channel.guild, { action: 'MASS_CHANNEL_DELETE_DETECTED', actionCount: massActionCheck.actionCount, reason: 'Multiple channel deletions detected' });
          }
        }
      }
    } catch (error) {
      logger.error(`Error in ChannelDelete handler:`, error);
    }
  },
};

const onClientReady: ModuleEvent = { event: Events.ClientReady,
  handler: async (client) => {
    logger.info('AntiRaid module ready, starting lockdown expiry checker');

    setInterval(async () => {
      try {
        for (const guild of client.guilds.cache.values()) {
          const config = await getAntiRaidConfig(guild.id);
          if (!config.enabled) continue;
          // Lockdown expiry is handled via Redis TTL
        }
      } catch (error) {
        logger.error(`Error checking lockdown expiry:`, error);
      }
    }, 30000);
  },
};

export const antiRaidEvents: ModuleEvent[] = [onGuildMemberAdd, onGuildBanAdd, onGuildMemberRemove, onRoleDelete, onChannelDelete, onClientReady];
