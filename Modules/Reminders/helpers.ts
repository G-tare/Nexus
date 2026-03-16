import { ButtonBuilder, ButtonStyle } from 'discord.js';
import { moduleContainer, addText, addFields, addButtons, v2Payload } from '../../Shared/src/utils/componentsV2';
import { getDb } from '../../Shared/src/database/connection';
import { reminders } from '../../Shared/src/database/models/schema';
import { timers } from '../../Shared/src/cache/timerManager';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export interface ReminderData {
  id: string; // User-facing ID (converted from DB serial number)
  userId: string;
  guildId?: string;
  channelId?: string;
  message: string;
  triggerAt: Date; // Maps to DB remindAt column
  createdAt: Date;
  recurring: boolean; // Maps to DB isRecurring column
  interval?: number; // In milliseconds; maps to DB recurringInterval (in seconds)
  dmFallback: boolean; // Maps to DB isDm column
}

/**
 * Convert numeric DB ID to string for user-facing display.
 * This is a no-op but makes the intent clear.
 */
export function convertDbIdToString(id: number): string {
  return String(id);
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
 * Create a reminder and store in Postgres + schedule with TimerManager.
 * The `client` parameter is needed to schedule the fire callback.
 * Note: The `data.id` field is ignored; the DB generates the ID automatically.
 */
export async function createReminder(client: any, data: ReminderData): Promise<ReminderData> {
  const db = getDb();
  const intervalSeconds = data.interval ? Math.floor(data.interval / 1000) : null;

  // Store in Postgres (id is auto-generated serial)
  const result = await db.insert(reminders).values({
    userId: data.userId,
    guildId: data.guildId || null,
    channelId: data.channelId || null,
    message: data.message,
    remindAt: data.triggerAt,
    createdAt: data.createdAt,
    isRecurring: data.recurring,
    recurringInterval: intervalSeconds,
    isDm: data.dmFallback,
    isSent: false,
  }).returning({ id: reminders.id });

  // The DB returns the generated ID
  const dbId = result[0]?.id;
  if (!dbId) throw new Error('Failed to create reminder: no ID returned');

  const displayId = convertDbIdToString(dbId);
  const reminder = { ...data, id: displayId };

  // Schedule with TimerManager
  scheduleReminder(client, reminder);

  return reminder;
}

/**
 * Schedule a reminder to fire at its triggerAt time.
 * The reminder.id is a string representation of the numeric DB ID.
 */
export function scheduleReminder(client: any, reminder: ReminderData): void {
  const timerId = `reminder:${reminder.id}`;
  const dbId = parseInt(reminder.id, 10);

  timers.schedule(timerId, reminder.triggerAt, async () => {
    try {
      await fireReminder(client, reminder);

      const db = getDb();

      if (!reminder.recurring) {
        // Non-recurring: delete from Postgres
        await db.delete(reminders).where(eq(reminders.id, dbId));
      } else if (reminder.interval) {
        // Recurring: reschedule
        const nextTrigger = new Date(reminder.triggerAt.getTime() + reminder.interval);
        const intervalSeconds = Math.floor(reminder.interval / 1000);

        await db.update(reminders)
          .set({ remindAt: nextTrigger })
          .where(eq(reminders.id, dbId));

        // Schedule next occurrence
        const updatedReminder = { ...reminder, triggerAt: nextTrigger };
        scheduleReminder(client, updatedReminder);
      }
    } catch (error) {
      console.error(`[Reminders] Error firing reminder ${reminder.id}:`, error);
    }
  });
}

/**
 * Get a single reminder from Postgres by display ID.
 * The display ID is the string representation of the numeric DB ID.
 */
export async function getReminder(displayId: string): Promise<ReminderData | null> {
  const db = getDb();
  const dbId = parseInt(displayId, 10);

  if (isNaN(dbId)) return null;

  const [row] = await db.select()
    .from(reminders)
    .where(eq(reminders.id, dbId))
    .limit(1);

  if (!row) return null;

  return {
    id: convertDbIdToString(row.id),
    userId: row.userId,
    guildId: row.guildId || undefined,
    channelId: row.channelId || undefined,
    message: row.message,
    triggerAt: row.remindAt,
    createdAt: row.createdAt,
    recurring: row.isRecurring,
    interval: row.recurringInterval ? row.recurringInterval * 1000 : undefined,
    dmFallback: row.isDm,
  };
}

/**
 * Get all reminders for a user.
 */
export async function getUserReminders(userId: string): Promise<ReminderData[]> {
  const db = getDb();
  const rows = await db.select()
    .from(reminders)
    .where(eq(reminders.userId, userId));

  return rows.map(row => ({
    id: convertDbIdToString(row.id),
    userId: row.userId,
    guildId: row.guildId || undefined,
    channelId: row.channelId || undefined,
    message: row.message,
    triggerAt: row.remindAt,
    createdAt: row.createdAt,
    recurring: row.isRecurring,
    interval: row.recurringInterval ? row.recurringInterval * 1000 : undefined,
    dmFallback: row.isDm,
  })).sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime());
}

/**
 * Cancel a reminder.
 */
export async function cancelReminder(reminderId: string, userId: string): Promise<boolean> {
  const reminder = await getReminder(reminderId);
  if (!reminder) return false;
  if (reminder.userId !== userId) return false;

  const db = getDb();
  const dbId = parseInt(reminderId, 10);

  if (isNaN(dbId)) return false;

  // Remove from Postgres
  await db.delete(reminders).where(eq(reminders.id, dbId));

  // Cancel scheduled timer
  timers.cancel(`reminder:${reminderId}`);

  return true;
}

/**
 * Snooze a reminder by creating a new one with updated triggerAt.
 */
export async function snoozeReminder(
  client: any,
  reminderId: string,
  userId: string,
  duration: number
): Promise<ReminderData | null> {
  const original = await getReminder(reminderId);
  if (!original || original.userId !== userId) return null;

  // Cancel the original
  await cancelReminder(reminderId, userId);

  // Create new reminder (note: id field is ignored by createReminder)
  const newReminder: ReminderData = {
    id: '', // Will be ignored; DB generates the ID
    userId: original.userId,
    guildId: original.guildId,
    channelId: original.channelId,
    message: original.message,
    triggerAt: new Date(Date.now() + duration),
    createdAt: new Date(),
    recurring: original.recurring,
    interval: original.interval,
    dmFallback: original.dmFallback,
  };

  return createReminder(client, newReminder);
}

/**
 * Build a reminder container
 */
export function buildReminderContainer(reminder: ReminderData, userId?: string) {
  const container = moduleContainer('reminders');
  addText(container, `### ⏰ Reminder\n${reminder.message || '*(no message)*'}`);

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
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
  ];

  if (reminder.recurring && reminder.interval) {
    fields.push({
      name: 'Repeats',
      value: `Every ${formatDuration(reminder.interval)}`,
      inline: true,
    });
  }

  addFields(container, fields);
  return container;
}

/**
 * Build a list container for all user reminders
 */
export function buildReminderListContainer(reminderList: ReminderData[]) {
  const container = moduleContainer('reminders');
  addText(container, '### ⏰ Your Reminders');

  if (reminderList.length === 0) {
    addText(container, 'You have no active reminders.');
    return container;
  }

  const fields = reminderList.slice(0, 25).map((r) => ({
    name: `${r.id} • ${r.message.substring(0, 40)}${r.message.length > 40 ? '...' : ''}`,
    value: `Fires <t:${Math.floor(r.triggerAt.getTime() / 1000)}:R>${r.recurring ? ` • Repeats every ${formatDuration(r.interval!)}` : ''}`,
    inline: false,
  }));

  addFields(container, fields);

  if (reminderList.length > 25) {
    addText(container, `-# Showing 25 of ${reminderList.length} reminders`);
  }

  return container;
}

/**
 * Build snooze buttons for a reminder
 */
export function buildSnoozeButtons(reminderId: string): ButtonBuilder[] {
  return [
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
  ];
}

/**
 * Fire a reminder - send DM and channel message if possible
 */
export async function fireReminder(client: any, reminder: ReminderData): Promise<void> {
  const user = await client.users.fetch(reminder.userId).catch(() => null);

  if (!user) {
    return;
  }

  const container = buildReminderContainer(reminder, reminder.userId);
  const buttons = buildSnoozeButtons(reminder.id);
  addButtons(container, buttons);
  const payload = v2Payload([container]);

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
            ...payload,
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
    await dmChannel.send(payload);
  } catch (error) {
    if (!sentToChannel) {
      console.warn(`[Reminders] Could not DM user ${reminder.userId} and channel message failed`);
    }
  }
}
