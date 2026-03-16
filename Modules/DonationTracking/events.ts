import { Events, Client } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('DonationTracking:Events');

export const donationEvents: ModuleEvent[] = [
  {
    name: 'clientReady',
    event: Events.ClientReady,
    once: true,
    async handler(client: Client) {
      logger.info('DonationTracking module initialized');
    },
  },
];
