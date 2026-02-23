import { Events, GuildMember, Client } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  getAutoRolesConfig,
  getAutoRoleRules,
  evaluateCondition,
  queueDelayedRole,
  processDelayedRoles,
  saveMemberRoles,
  restoreMemberRoles,
  logAutoRole,
  CONDITION_LABELS,
} from './helpers';

const logger = createModuleLogger('AutoRoles:Events');

/**
 * On member join: evaluate auto-role rules and assign/queue roles.
 */
const memberJoinHandler: ModuleEvent = { event: Events.GuildMemberAdd,
  async handler(member: GuildMember) {
    if (!member.guild) return;

    const guildId = member.guild.id;
    const config = await getAutoRolesConfig(guildId);

    // Ignore bots if configured
    if (config.ignoreBots && member.user.bot) return;

    // Restore persistent roles first
    if (config.persistentRoles) {
      const restored = await restoreMemberRoles(member);
      if (restored.length > 0) {
        logger.info('Restored persistent roles', {
          guild: guildId,
          member: member.id,
          roles: restored,
        });
        for (const roleName of restored) {
          await logAutoRole(member.guild, member, roleName, 'Persistent role restore (rejoin)');
        }
      }
    }

    // Get all rules
    const rules = await getAutoRoleRules(guildId);
    const enabledRules = rules.filter(r => r.enabled);

    if (enabledRules.length === 0) return;

    // TODO: In a full implementation, we'd track which invite code was used.
    // For now, invite_code condition won't work without invite tracking integration.
    const inviteCode: string | undefined = undefined;

    for (const rule of enabledRules) {
      // Evaluate condition
      if (!evaluateCondition(member, rule, inviteCode)) continue;

      const role = member.guild.roles.cache.get(rule.roleId);
      if (!role) {
        logger.debug('Auto-role: role not found', { roleId: rule.roleId, guildId });
        continue;
      }

      // Check if bot can assign this role
      const botMember = member.guild.members.me;
      if (botMember && role.position >= botMember.roles.highest.position) {
        logger.debug('Auto-role: role too high', { role: role.name, guildId });
        continue;
      }

      if (rule.delaySeconds > 0) {
        // Queue for later
        await queueDelayedRole(guildId, member.id, rule.roleId, rule.delaySeconds, rule.id);
        logger.debug('Auto-role queued (delayed)', {
          guild: guildId,
          member: member.id,
          role: role.name,
          delay: rule.delaySeconds,
        });
      } else {
        // Assign immediately
        try {
          await member.roles.add(role, `Auto-role: ${CONDITION_LABELS[rule.condition]}`);
          await logAutoRole(member.guild, member, role.name, CONDITION_LABELS[rule.condition]);
          logger.debug('Auto-role assigned', {
            guild: guildId,
            member: member.id,
            role: role.name,
          });
        } catch (err: any) {
          logger.error('Failed to assign auto-role', { error: err.message, role: role.name });
        }
      }

      // If not stacking, stop after first match
      if (!config.stackRoles) break;
    }
  },
};

/**
 * On member leave: save roles for persistent role restore.
 */
const memberLeaveHandler: ModuleEvent = { event: Events.GuildMemberRemove,
  async handler(member: GuildMember) {
    if (!member.guild) return;

    const config = await getAutoRolesConfig(member.guild.id);
    if (!config.persistentRoles) return;

    const roleIds = member.roles.cache.map(r => r.id);
    await saveMemberRoles(member.guild.id, member.id, roleIds);

    logger.debug('Saved persistent roles', {
      guild: member.guild.id,
      member: member.id,
      roles: roleIds.length,
    });
  },
};

/**
 * On member update: handle boost auto-role.
 */
const memberUpdateHandler: ModuleEvent = { event: Events.GuildMemberUpdate,
  async handler(oldMember: GuildMember, newMember: GuildMember) {
    if (!newMember.guild) return;

    // Check if member started boosting
    const wasBoosting = oldMember.premiumSince !== null;
    const isBoosting = newMember.premiumSince !== null;

    if (!wasBoosting && isBoosting) {
      // Just started boosting — check for boost condition rules
      const rules = await getAutoRoleRules(newMember.guild.id);
      const boostRules = rules.filter(r => r.enabled && r.condition === 'boost');

      for (const rule of boostRules) {
        const role = newMember.guild.roles.cache.get(rule.roleId);
        if (!role) continue;
        if (newMember.roles.cache.has(role.id)) continue;

        try {
          await newMember.roles.add(role, 'Auto-role: Server booster');
          await logAutoRole(newMember.guild, newMember, role.name, 'Server booster');
        } catch (err: any) {
          logger.error('Failed to assign boost auto-role', { error: err.message });
        }
      }
    } else if (wasBoosting && !isBoosting) {
      // Stopped boosting — remove boost auto-roles
      const rules = await getAutoRoleRules(newMember.guild.id);
      const boostRules = rules.filter(r => r.enabled && r.condition === 'boost');

      for (const rule of boostRules) {
        if (newMember.roles.cache.has(rule.roleId)) {
          try {
            await newMember.roles.remove(rule.roleId, 'Auto-role: Stopped boosting');
          } catch (err: any) {
            logger.debug('Failed to remove boost role', { error: err.message });
          }
        }
      }
    }
  },
};

/**
 * On ready: start delayed role processing interval.
 */
const readyHandler: ModuleEvent = { event: Events.ClientReady,
  once: true,
  async handler(client: Client) {
    logger.info('Starting delayed role processor');

    // Process delayed roles every 30 seconds
    setInterval(async () => {
      for (const guild of client.guilds.cache.values()) {
        try {
          const processed = await processDelayedRoles(guild);
          if (processed > 0) {
            logger.debug('Processed delayed roles', { guild: guild.id, count: processed });
          }
        } catch (err: any) {
          logger.error('Delayed role processing error', { guild: guild.id, error: err.message });
        }
      }
    }, 30_000);
  },
};

export const autoRolesEvents: ModuleEvent[] = [
  memberJoinHandler,
  memberLeaveHandler,
  memberUpdateHandler,
  readyHandler,
];
