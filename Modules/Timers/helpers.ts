import { Client, ContainerBuilder } from 'discord.js';
import { getDb } from '../../Shared/src/database/connection';
import { timers } from '../../Shared/src/database/models/schema';
import { guildModuleConfigs } from '../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { moduleContainer, successContainer, addText, addFields, addFooter, addSeparator, v2Payload } from '../../Shared/src/utils/componentsV2';
import { formatDuration, discordTimestamp } from '../../Shared/src/utils/time';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Timers:Helpers');

/**
 * Timer data interface
 */
export interface TimerData {
  id: number;
  guildId: string;
  userId: string;
  label: string;
  channelId: string | null;
  messageId: string | null;
  notifyInDm: boolean;
  isActive: boolean;
  startsAt: Date;
  endsAt: Date;
  endedAt: Date | null;
}

/**
 * Timer config interface
 */
export interface TimerConfig {
  maxPerUser: number;
  maxDurationMs: number;
  defaultNotifyChannelId: string | null;
  allowDm: boolean;
  embedColor: string;
  logChannelId: string | null;
}

/**
 * Get timer config for a guild
 */
export async function getTimerConfig(guildId: string): Promise<TimerConfig> {
  const db = getDb();
  try {
    const configRow = await db
      .select()
      .from(guildModuleConfigs)
      .where(
        and(
          eq(guildModuleConfigs.guildId, guildId),
          eq(guildModuleConfigs.module, 'timers')
        )
      );

    if (configRow.length > 0 && configRow[0].config) {
      return configRow[0].config as TimerConfig;
    }
  } catch (error) {
    logger.error(`Failed to get timer config for guild ${guildId}:`, error);
  }

  // Return default config
  return {
    maxPerUser: 5,
    maxDurationMs: 30 * 24 * 60 * 60 * 1000,
    defaultNotifyChannelId: null,
    allowDm: true,
    embedColor: '#3498DB',
    logChannelId: null,
  };
}

/**
 * Create a new timer
 */
export async function createTimer(data: {
  guildId: string;
  userId: string;
  label: string;
  channelId: string | null;
  notifyInDm: boolean;
  endsAt: Date;
}): Promise<TimerData | null> {
  const db = getDb();
  try {
    const result = await db.insert(timers).values({
      guildId: data.guildId,
      userId: data.userId,
      label: data.label,
      channelId: data.channelId,
      notifyInDm: data.notifyInDm,
      isActive: true,
      startsAt: new Date(),
      endsAt: data.endsAt,
    }).returning();

    return result[0] || null;
  } catch (error) {
    logger.error('Failed to create timer:', error);
    return null;
  }
}

/**
 * Get a single timer by ID
 */
export async function getTimer(timerId: number): Promise<TimerData | null> {
  const db = getDb();
  try {
    const result = await db
      .select()
      .from(timers)
      .where(eq(timers.id, timerId));

    return result[0] || null;
  } catch (error) {
    logger.error(`Failed to get timer ${timerId}:`, error);
    return null;
  }
}

/**
 * Get all active timers for a user in a guild
 */
export async function getUserTimers(guildId: string, userId: string): Promise<TimerData[]> {
  const db = getDb();
  try {
    const result = await db
      .select()
      .from(timers)
      .where(
        and(
          eq(timers.guildId, guildId),
          eq(timers.userId, userId),
          eq(timers.isActive, true)
        )
      );

    return result;
  } catch (error) {
    logger.error(`Failed to get user timers for ${userId}:`, error);
    return [];
  }
}

/**
 * Get all active timers in a guild
 */
export async function getGuildTimers(guildId: string): Promise<TimerData[]> {
  const db = getDb();
  try {
    const result = await db
      .select()
      .from(timers)
      .where(
        and(
          eq(timers.guildId, guildId),
          eq(timers.isActive, true)
        )
      );

    return result;
  } catch (error) {
    logger.error(`Failed to get guild timers for ${guildId}:`, error);
    return [];
  }
}

/**
 * Cancel a timer (mark as inactive)
 */
export async function cancelTimer(timerId: number): Promise<boolean> {
  const db = getDb();
  try {
    await db
      .update(timers)
      .set({ isActive: false })
      .where(eq(timers.id, timerId));

    return true;
  } catch (error) {
    logger.error(`Failed to cancel timer ${timerId}:`, error);
    return false;
  }
}

/**
 * End a timer - mark as inactive and set endedAt
 */
export async function markTimerEnded(timerId: number): Promise<boolean> {
  const db = getDb();
  try {
    await db
      .update(timers)
      .set({ isActive: false, endedAt: new Date() })
      .where(eq(timers.id, timerId));

    return true;
  } catch (error) {
    logger.error(`Failed to mark timer ${timerId} as ended:`, error);
    return false;
  }
}

/**
 * Send timer end notification
 */
export async function endTimer(timer: TimerData, client: Client): Promise<void> {
  try {
    const user = await client.users.fetch(timer.userId).catch(() => null);
    if (!user) return;

    const payload = buildTimerEndedPayload(timer);

    let sentToChannel = false;

    // Try to send to original channel if specified
    if (timer.channelId && timer.guildId) {
      try {
        const guild = await client.guilds.fetch(timer.guildId).catch(() => null);
        if (guild) {
          const channel = await guild.channels.fetch(timer.channelId).catch(() => null);
          if (channel && channel.isTextBased()) {
            await (channel as any).send({
              content: `<@${timer.userId}>`,
              ...payload,
            });
            sentToChannel = true;
          }
        }
      } catch (error) {
        // Channel not accessible
      }
    }

    // Send DM if notifyInDm is true or if channel notification failed
    if (timer.notifyInDm || !sentToChannel) {
      try {
        const dmChannel = await user.createDM();
        await dmChannel.send(payload);
      } catch (error) {
        logger.warn(`Could not DM user ${timer.userId} about timer ${timer.id}`);
      }
    }

    // Mark timer as ended
    await markTimerEnded(timer.id);
  } catch (error) {
    logger.error(`Failed to end timer ${timer.id}:`, error);
  }
}

/**
 * Build timer info container
 */
export function buildTimerContainer(timer: TimerData): ContainerBuilder {
  const duration = timer.endsAt.getTime() - timer.startsAt.getTime();
  const timeRemaining = timer.endsAt.getTime() - Date.now();

  const container = moduleContainer('timers');
  addText(container, '### ⏱️ Timer\n' + timer.label);
  addSeparator(container, 'small');
  addFields(container, [
    {
      name: 'Total Duration',
      value: formatDuration(duration),
      inline: true,
    },
    {
      name: 'Time Remaining',
      value: timeRemaining > 0 ? formatDuration(timeRemaining) : '(Expired)',
      inline: true,
    },
    {
      name: 'Ends At',
      value: discordTimestamp(timer.endsAt),
      inline: true,
    },
    {
      name: 'ID',
      value: `\`${timer.id}\``,
      inline: true,
    }
  ]);

  return container;
}

/**
 * Build timer ended notification payload
 */
export function buildTimerEndedPayload(timer: TimerData) {
  const duration = timer.endsAt.getTime() - timer.startsAt.getTime();

  const container = successContainer('⏰ Timer Ended!', timer.label);
  addSeparator(container, 'small');
  addFields(container, [
    {
      name: 'Duration',
      value: formatDuration(duration),
      inline: true,
    },
    {
      name: 'Ended At',
      value: discordTimestamp(new Date()),
      inline: true,
    }
  ]);

  return v2Payload([container]);
}
