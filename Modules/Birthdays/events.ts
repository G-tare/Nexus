import { Client, Events, TextChannel } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import {
  getBirthdayConfig,
  getTodaysBirthdays,
  wasBirthdayAnnounced,
  markBirthdayAnnounced,
  trackBirthdayRole,
  getBirthdayRoleUsers,
  removeBirthdayRoleTracking,
  getAge,
  parseAnnouncementMessage,
  buildBirthdayAnnouncementContainer,
} from './helpers';
import { v2Payload } from '../../Shared/src/utils/componentsV2';
import { eventBus } from '../../Shared/src/events/eventBus';
import { getDb } from '../../Shared/src/database/connection';
import { guilds } from '../../Shared/src/database/models/schema';
import { eq } from 'drizzle-orm';

let birthdayInterval: NodeJS.Timeout | null = null;
let roleCleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start the daily birthday checker.
 * Runs every 15 minutes to catch birthdays across timezones.
 */
export function startBirthdayChecker(client: Client): void {
  // Run immediately on startup
  checkBirthdays(client).catch((err) => console.error('[Birthdays] Startup check error:', err));

  // Run every 15 minutes
  birthdayInterval = setInterval(() => {
    checkBirthdays(client).catch((err) => console.error('[Birthdays] Check error:', err));
  }, 15 * 60 * 1000);

  // Role cleanup every hour
  roleCleanupInterval = setInterval(() => {
    cleanupBirthdayRoles(client).catch((err) => console.error('[Birthdays] Role cleanup error:', err));
  }, 60 * 60 * 1000);

  console.log('[Birthdays] Birthday checker started (15min interval)');
}

export function stopBirthdayChecker(): void {
  if (birthdayInterval) {
    clearInterval(birthdayInterval);
    birthdayInterval = null;
  }
  if (roleCleanupInterval) {
    clearInterval(roleCleanupInterval);
    roleCleanupInterval = null;
  }
  console.log('[Birthdays] Birthday checker stopped');
}

/**
 * Check all guilds for today's birthdays and announce them.
 */
async function checkBirthdays(client: Client): Promise<void> {
  const db = getDb();
  // Get all active guilds the bot is in
  const activeGuilds = await db
    .select({ id: guilds.id })
    .from(guilds)
    .where(eq(guilds.isActive, true));

  for (const guild of activeGuilds) {
    try {
      const config = await getBirthdayConfig(guild.id);
      if (!config.enabled || !config.channelId) continue;

      const todaysBirthdays = await getTodaysBirthdays(guild.id);
      if (todaysBirthdays.length === 0) continue;

      const discordGuild = client.guilds.cache.get(guild.id);
      if (!discordGuild) continue;

      const channel = discordGuild.channels.cache.get(config.channelId) as TextChannel;
      if (!channel || !channel.isTextBased()) continue;

      for (const entry of todaysBirthdays) {
        // Check if already announced today
        const announced = await wasBirthdayAnnounced(guild.id, entry.userId);
        if (announced) continue;

        try {
          // Calculate age if applicable
          const age = entry.birthdayYear ? getAge(entry.birthdayYear, entry.birthday) : null;
          const showAge = config.showAge && !entry.hideYear && age !== null;

          // Build announcement message
          const displayName = entry.globalName || entry.username || 'Unknown';
          const message = parseAnnouncementMessage(
            config.announcementMessage,
            entry.userId,
            displayName,
            showAge ? age : null
          ).replace(/\{server\}/g, discordGuild.name);

          // Build container
          const container = buildBirthdayAnnouncementContainer(
            entry.userId,
            displayName,
            message,
            showAge ? age : null,
            config.showAge
          );

          // Send announcement
          await (channel as any).send(v2Payload([container]));
          await markBirthdayAnnounced(guild.id, entry.userId);

          // Assign birthday role if configured
          if (config.roleId) {
            try {
              const member = await discordGuild.members.fetch(entry.userId);
              if (member) {
                await member.roles.add(config.roleId, 'Birthday role');
                await trackBirthdayRole(guild.id, entry.userId);
              }
            } catch (err) {
              console.error(`[Birthdays] Failed to assign birthday role to ${entry.userId}:`, err);
            }
          }

          // Send DM if enabled
          if (config.dmNotification) {
            try {
              const member = await discordGuild.members.fetch(entry.userId);
              if (member) {
                await member.user.send({
                  content: `🎂 Happy Birthday from **${discordGuild.name}**! 🎉\nYour server is celebrating your birthday today!`,
                });
              }
            } catch {
              // DMs might be disabled
            }
          }

          // Emit event for cross-module connections
          eventBus.emit('birthdayTriggered', {
            guildId: guild.id,
            userId: entry.userId,
          });

          // Audit log
          eventBus.emit('auditLog', {
            guildId: guild.id,
            type: 'BIRTHDAY_ANNOUNCED',
            data: { userId: entry.userId, age: showAge ? age : null },
          });
        } catch (err) {
          console.error(`[Birthdays] Failed to announce birthday for ${entry.userId} in ${guild.id}:`, err);
        }
      }
    } catch (err) {
      console.error(`[Birthdays] Error checking guild ${guild.id}:`, err);
    }
  }
}

/**
 * Remove birthday roles from users whose birthday was yesterday.
 * Runs hourly, checks if 24h has passed since role was assigned.
 */
async function cleanupBirthdayRoles(client: Client): Promise<void> {
  const db = getDb();
  const activeGuilds = await db
    .select({ id: guilds.id })
    .from(guilds)
    .where(eq(guilds.isActive, true));

  for (const guild of activeGuilds) {
    try {
      const config = await getBirthdayConfig(guild.id);
      if (!config.enabled || !config.roleId) continue;

      const todaysBirthdays = await getTodaysBirthdays(guild.id);
      const todayUserIds = new Set(todaysBirthdays.map((b) => b.userId));

      // Get all users who have the birthday role tracked
      const trackedUsers = await getBirthdayRoleUsers(guild.id);
      const discordGuild = client.guilds.cache.get(guild.id);
      if (!discordGuild) continue;

      for (const userId of trackedUsers) {
        // If it's still their birthday today, skip
        if (todayUserIds.has(userId)) continue;

        // Remove the birthday role
        try {
          const member = await discordGuild.members.fetch(userId);
          if (member && member.roles.cache.has(config.roleId)) {
            await member.roles.remove(config.roleId, 'Birthday over');
          }
        } catch {
          // Member might have left
        }

        await removeBirthdayRoleTracking(guild.id, userId);
      }
    } catch (err) {
      console.error(`[Birthdays] Role cleanup error for guild ${guild.id}:`, err);
    }
  }
}

export const birthdayEvents: ModuleEvent[] = [
  { event: Events.ClientReady,
    once: true,
    async handler(client: Client) {
      startBirthdayChecker(client);
    },
  },
];
