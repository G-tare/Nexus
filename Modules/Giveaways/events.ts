import {  Client, TextChannel, ButtonInteraction, MessageFlags, Events } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { getDb } from '../../Shared/src/database/connection';
import { giveaways } from '../../Shared/src/database/models/schema';
import { eq, and, lte } from 'drizzle-orm';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  getGiveaway, getGiveawayByMessage, enterGiveaway, endGiveaway,
  getActiveGiveaways, buildGiveawayEmbed, buildGiveawayComponents,
  getGiveawayConfig, GiveawayData,
} from './helpers';
import { eventBus } from '../../Shared/src/events/eventBus';

const logger = createModuleLogger('Giveaways:Events');

async function handleGiveawayButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith('giveaway_enter_')) return;
  const giveawayId = parseInt(interaction.customId.replace('giveaway_enter_', ''));
  if (isNaN(giveawayId)) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await enterGiveaway(giveawayId, interaction.user.id);
  if (result.success) {
    await interaction.editReply({ content: '✅ You have entered the giveaway! Good luck!' });
  } else {
    await interaction.editReply({ content: `❌ ${result.reason || 'Could not enter giveaway.'}` });
  }
}

async function checkExpiredGiveaways(client: Client): Promise<void> {
  const db = getDb();
  try {
    const expired = await db.select().from(giveaways)
      .where(and(eq(giveaways.isActive, true), lte(giveaways.endsAt, new Date())));

    for (const row of expired) {
      try {
        const guild = client.guilds.cache.get(row.guildId);
        if (!guild) continue;
        const giveaway = await getGiveaway(row.id);
        if (!giveaway) continue;
        const winners = await endGiveaway(giveaway, guild);
        eventBus.emit('giveawayEnded', {
          guildId: row.guildId, giveawayId: row.id,
          winners, prize: row.prize,
        });
      } catch (error) {
        logger.error(`Failed to end giveaway ${row.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Failed to check expired giveaways:', error);
  }
}

export const giveawayEvents: ModuleEvent[] = [
  { name: 'interactionCreate',
    event: 'interactionCreate',
    async handler(interaction: any) {
      if (interaction.isButton?.()) {
        await handleGiveawayButton(interaction as ButtonInteraction);
      }
    },
  },
  { name: 'clientReady',
    event: Events.ClientReady,
    once: true,
    async handler(client: Client) {
      // Check for expired giveaways every 30 seconds
      setInterval(() => checkExpiredGiveaways(client), 30_000);
      logger.info('Giveaway expiration checker started');
    },
  },
];
