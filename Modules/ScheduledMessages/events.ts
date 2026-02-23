import { Client, Events } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { eventBus } from '../../Shared/src/events/eventBus';

const logger = createModuleLogger('ScheduledMessages:Events');

/**
 * Scheduled Messages events.
 * The scheduler itself runs on a timer (see scheduler.ts),
 * but we listen for ClientReady to start it.
 */
export const scheduledMessagesEvents: ModuleEvent[] = [
  { event: Events.ClientReady,
    once: true,
    async handler(client: Client) {
      logger.info('Scheduled Messages events registered');

      // Listen for audit log events related to scheduled messages
      eventBus.on('auditLog', async (data) => {
        if (data.type === 'SCHEDULED_MESSAGE_SENT') {
          logger.debug(`Scheduled message sent in guild ${data.guildId}`, data.data);
        }
      });
    },
  },
];
