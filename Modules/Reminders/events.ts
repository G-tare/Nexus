import { ModuleEvent } from '../../Shared/src/types/command';
import { Events } from 'discord.js';
import { scheduleReminder, ReminderData, convertDbIdToString } from './helpers';
import { getDb } from '../../Shared/src/database/connection';
import { reminders } from '../../Shared/src/database/models/schema';
import { timers } from '../../Shared/src/cache/timerManager';

export const reminderEvents: ModuleEvent[] = [
  { event: Events.ClientReady,
    once: true,
    handler: async (client) => {
      console.log('[Reminders] Loading pending reminders from Postgres...');

      // Load all pending reminders from Postgres and schedule them with TimerManager
      await timers.loadFromSource(
        'reminder',
        async () => {
          const db = getDb();
          const rows = await db.select().from(reminders);
          return rows.map(row => ({
            id: convertDbIdToString(row.id),
            executeAt: row.remindAt,
          }));
        },
        (displayId: string) => {
          // Build a callback that loads the full reminder and fires it
          return async () => {
            const db = getDb();
            const { eq } = await import('drizzle-orm');
            const dbId = parseInt(displayId, 10);

            const [row] = await db.select()
              .from(reminders)
              .where(eq(reminders.id, dbId))
              .limit(1);

            if (!row) return; // Reminder was cancelled

            const reminder: ReminderData = {
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

            const { fireReminder } = await import('./helpers');
            await fireReminder(client, reminder);

            if (!reminder.recurring) {
              await db.delete(reminders).where(eq(reminders.id, dbId));
            } else if (reminder.interval) {
              const nextTrigger = new Date(reminder.triggerAt.getTime() + reminder.interval);
              await db.update(reminders)
                .set({ remindAt: nextTrigger })
                .where(eq(reminders.id, dbId));

              const updatedReminder = { ...reminder, triggerAt: nextTrigger };
              scheduleReminder(client, updatedReminder);
            }
          };
        }
      );

      console.log(`[Reminders] Loaded ${timers.activeCount()} timers`);
    }
  }
];
