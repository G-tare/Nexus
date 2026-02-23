import { ModuleEvent } from '../../Shared/src/types/command';
import { Events } from 'discord.js';
import { getReminder, fireReminder } from './helpers';
import { getRedis } from '../../Shared/src/database/connection';

export const reminderEvents: ModuleEvent[] = [
  { event: Events.ClientReady,
    once: true,
    handler: async (client) => {
      console.log('[Reminders] Reminder checker started');

      const redis = getRedis();

      // Check for due reminders every 10 seconds
      setInterval(async () => {
        try {
          const now = Date.now();

          // Get all reminders that are due
          const dueReminderIds = await redis.zrangebyscore('reminders:pending', 0, now);

          for (const reminderId of dueReminderIds) {
            try {
              const reminder = await getReminder(redis, reminderId);
              if (!reminder) {
                // Reminder was deleted
                await redis.zrem('reminders:pending', reminderId);
                continue;
              }

              // Fire the reminder
              await fireReminder(client, redis, reminder);

              // If not recurring, remove from pending
              if (!reminder.recurring) {
                await redis.zrem('reminders:pending', reminderId);
                const userId = reminder.userId;
                await redis.srem(`user:${userId}:reminders`, reminderId);
                await redis.del(`reminder:${reminderId}`);
              } else {
                // Reschedule recurring reminder
                const nextTrigger = new Date(reminder.triggerAt.getTime() + reminder.interval!);
                await redis.zadd('reminders:pending', nextTrigger.getTime(), reminderId);

                // Update the reminder's triggerAt in Redis
                await redis.hset(`reminder:${reminderId}`, 'triggerAt', nextTrigger.toISOString());
              }
            } catch (error) {
              console.error(`[Reminders] Error firing reminder ${reminderId}:`, error);
            }
          }
        } catch (error) {
          console.error('[Reminders] Error in reminder checker:', error);
        }
      }, 10000); // 10 second interval
    }
  }
];
