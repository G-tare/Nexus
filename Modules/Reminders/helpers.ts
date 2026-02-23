import { EmbedBuilder, APIEmbedField, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import crypto from 'crypto';

export interface ReminderData {
  id: string;
  userId: string;
  guildId?: string;
  channelId?: string;
  message: string;
  triggerAt: Date;
  createdAt: Date;
  recurring: boolean;
  interval?: number;
  snoozedFrom?: string;
  dmFallback: boolean;
}

/**
 * Generate a short random ID (6 chars)
 */
export function generateReminderId(): string {
  return crypto.randomBytes(3).toString('hex');
}

/**
 * Parse duration string to milliseconds
 * Supports: "30m", "2h", "1d", "1w", "tomorrow"
 */
export function parseDuration(timeStr: string): number | null {
  const normalized = timeStr.toLowerCase().trim();

  // Handle "tomorrow"
  if (normalized === 'tomorrow') {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    return tomorrow.getTime() - now.getTime();
  }

  const match = normalized.match(/^(\d+)([smhdw])$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] || 0) || null;
}

/**
 * Format milliseconds to human-readable duration
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) return `${weeks}w`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/**
 * Create a reminder and store in Redis
 */
export async function createReminder(redis: any, data: ReminderData): Promise<ReminderData> {
  const reminderId = data.id || generateReminderId();
  const reminderKey = `reminder:${reminderId}`;

  // Store reminder details in hash
  await redis.hset(reminderKey, {
    id: reminderId,
    userId: data.userId,
    guildId: data.guildId || '',
    channelId: data.channelId || '',
    message: data.message,
    triggerAt: data.triggerAt.toISOString(),
    createdAt: data.createdAt.toISOString(),
    recurring: data.recurring ? '1' : '0',
    interval: data.interval?.toString() || '',
    snoozedFrom: data.snoozedFrom || '',
    dmFallback: data.dmFallback ? '1' : '0',
  });

  // Add to sorted set for easy retrieval of due reminders
  await redis.zadd('reminders:pending', data.triggerAt.getTime(), reminderId);

  // Track user's reminders
  await redis.sadd(`user:${data.userId}:reminders`, reminderId);

  // Set TTL on reminder key (30 days)
  await redis.expire(reminderKey, 30 * 24 * 60 * 60);

  return { ...data, id: reminderId };
}

/**
 * Get a single reminder from Redis
 */
export async function getReminder(redis: any, reminderId: string): Promise<ReminderData | null> {
  const data = await redis.hgetall(`reminder:${reminderId}`);

  if (!data || !data.id) return null;

  return {
    id: data.id,
    userId: data.userId,
    guildId: data.guildId || undefined,
    channelId: data.channelId || undefined,
    message: data.message,
    triggerAt: new Date(data.triggerAt),
    createdAt: new Date(data.createdAt),
    recurring: data.recurring === '1',
    interval: data.interval ? parseInt(data.interval, 10) : undefined,
    snoozedFrom: data.snoozedFrom || undefined,
    dmFallback: data.dmFallback === '1',
  };
}

/**
 * Get all reminders for a user
 */
export async function getUserReminders(redis: any, userId: string): Promise<ReminderData[]> {
  const reminderIds = await redis.smembers(`user:${userId}:reminders`);
  const reminders: ReminderData[] = [];

  for (const id of reminderIds) {
    const reminder = await getReminder(redis, id);
    if (reminder) {
      reminders.push(reminder);
    }
  }

  return reminders.sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime());
}

/**
 * Cancel a reminder
 */
export async function cancelReminder(redis: any, reminderId: string, userId: string): Promise<boolean> {
  const reminder = await getReminder(redis, reminderId);

  if (!reminder) return false;
  if (reminder.userId !== userId) return false;

  // Remove from pending sorted set
  await redis.zrem('reminders:pending', reminderId);

  // Remove from user's reminders
  await redis.srem(`user:${userId}:reminders`, reminderId);

  // Delete reminder hash
  await redis.del(`reminder:${reminderId}`);

  return true;
}

/**
 * Snooze a reminder by creating a new one with updated triggerAt
 */
export async function snoozeReminder(
  redis: any,
  reminderId: string,
  userId: string,
  duration: number
): Promise<ReminderData | null> {
  const original = await getReminder(redis, reminderId);

  if (!original || original.userId !== userId) return null;

  // Cancel the original
  await cancelReminder(redis, reminderId, userId);

  // Create new reminder
  const newReminder: ReminderData = {
    id: generateReminderId(),
    userId: original.userId,
    guildId: original.guildId,
    channelId: original.channelId,
    message: original.message,
    triggerAt: new Date(Date.now() + duration),
    createdAt: new Date(),
    recurring: original.recurring,
    interval: original.interval,
    snoozedFrom: reminderId,
    dmFallback: original.dmFallback,
  };

  return createReminder(redis, newReminder);
}

/**
 * Build a reminder embed
 */
export function buildReminderEmbed(reminder: ReminderData, userId?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('⏰ Reminder')
    .setDescription(reminder.message || '*(no message)*')
    .addFields(
      {
        name: 'When',
        value: `<t:${Math.floor(reminder.triggerAt.getTime() / 1000)}:R>`,
        inline: true,
      },
      {
        name: 'ID',
        value: `\`${reminder.id}\``,
        inline: true,
      }
    )
    .setTimestamp();

  if (reminder.recurring && reminder.interval) {
    embed.addFields({
      name: 'Repeats',
      value: `Every ${formatDuration(reminder.interval)}`,
      inline: true,
    });
  }

  return embed;
}

/**
 * Build a list embed for all user reminders
 */
export function buildReminderListEmbed(reminders: ReminderData[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('⏰ Your Reminders')
    .setTimestamp();

  if (reminders.length === 0) {
    embed.setDescription('You have no active reminders.');
    return embed;
  }

  const fields: APIEmbedField[] = reminders.map((r) => ({
    name: `${r.id} • ${r.message.substring(0, 40)}${r.message.length > 40 ? '...' : ''}`,
    value: `Fires <t:${Math.floor(r.triggerAt.getTime() / 1000)}:R>${r.recurring ? ` • Repeats every ${formatDuration(r.interval!)}` : ''}`,
    inline: false,
  }));

  embed.addFields(fields.slice(0, 25));

  if (reminders.length > 25) {
    embed.setFooter({ text: `Showing 25 of ${reminders.length} reminders` });
  }

  return embed;
}

/**
 * Build snooze action row
 */
export function buildSnoozeRow(reminderId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`snooze_10m_${reminderId}`)
      .setLabel('Snooze 10m')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`snooze_30m_${reminderId}`)
      .setLabel('Snooze 30m')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`snooze_1h_${reminderId}`)
      .setLabel('Snooze 1h')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`snooze_dismiss_${reminderId}`)
      .setLabel('Dismiss')
      .setStyle(ButtonStyle.Danger)
  );
}

/**
 * Fire a reminder - send DM and channel message if possible
 */
export async function fireReminder(client: any, redis: any, reminder: ReminderData): Promise<void> {
  const user = await client.users.fetch(reminder.userId).catch(() => null);

  if (!user) {
    // User not found or bot can't access them
    return;
  }

  const embed = buildReminderEmbed(reminder, reminder.userId);
  const components = [buildSnoozeRow(reminder.id)];

  let sentToChannel = false;

  // Try to send to original channel
  if (reminder.channelId && reminder.guildId) {
    try {
      const guild = await client.guilds.fetch(reminder.guildId).catch(() => null);
      if (guild) {
        const channel = await guild.channels.fetch(reminder.channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          await (channel as any).send({
            content: `<@${reminder.userId}>`,
            embeds: [embed],
            components,
          });
          sentToChannel = true;
        }
      }
    } catch (error) {
      // Channel not found or no permission
    }
  }

  // Always try to DM the user
  try {
    const dmChannel = await user.createDM();
    await dmChannel.send({
      embeds: [embed],
      components,
    });
  } catch (error) {
    // DM failed - user might have DMs closed
    if (!sentToChannel) {
      console.warn(`[Reminders] Could not DM user ${reminder.userId} and channel message failed`);
    }
  }
}
