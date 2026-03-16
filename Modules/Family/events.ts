import { ModuleEvent } from '../../Shared/src/types/command';
import {
  ButtonInteraction,
  ChannelType,
  MessageFlags,
} from 'discord.js';
import {
  marry,
  adopt,
  getPendingRequest,
  deletePendingRequest,
  getDb,
  ensureRelationship,
} from './helpers';
import { familyPendingRequests } from '../../Shared/src/database/models/schema';
import { eq, lt } from 'drizzle-orm';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { moduleContainer, addText, v2Payload } from '../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Family');

const familyAcceptHandler: ModuleEvent = {
  event: 'interactionCreate',
  handler: async (interaction: any) => {
    if (!interaction.isButton()) return;

    const buttonId = interaction.customId;

    if (!buttonId.startsWith('family_accept_')) return;

    const requestId = parseInt(buttonId.replace('family_accept_', ''));

    try {
      const db = await getDb();
      const request = await db
        .select()
        .from(familyPendingRequests)
        .where(eq(familyPendingRequests.id, requestId))
        .limit(1);

      if (request.length === 0) {
        await interaction.reply({
          content: '❌ This request has expired or been deleted.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const req = request[0];

      if (req.toUserId !== interaction.user.id) {
        await interaction.reply({
          content: '❌ This request is not for you.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (req.type === 'marriage') {
        await ensureRelationship(interaction.guildId!, req.fromUserId);
        await ensureRelationship(interaction.guildId!, req.toUserId);
        await marry(interaction.guildId!, req.fromUserId, req.toUserId);

        const container = moduleContainer('family');
        addText(container, `### 💍 Marriage Accepted!\n<@${req.fromUserId}> and <@${req.toUserId}> are now married!`);

        await interaction.update({
          ...v2Payload([container]),
        });
      } else if (req.type === 'adoption') {
        await ensureRelationship(interaction.guildId!, req.fromUserId);
        await ensureRelationship(interaction.guildId!, req.toUserId);
        await adopt(interaction.guildId!, req.fromUserId, req.toUserId);

        const container = moduleContainer('family');
        addText(container, `### 👶 Adoption Accepted!\n<@${req.fromUserId}> has adopted <@${req.toUserId}>!`);

        await interaction.update({
          ...v2Payload([container]),
        });
      }

      await deletePendingRequest(requestId);
    } catch (error) {
      logger.error('Error accepting family request:', error);
      await interaction.reply({
        content: '❌ An error occurred processing your request.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

const familyDeclineHandler: ModuleEvent = {
  event: 'interactionCreate',
  handler: async (interaction: any) => {
    if (!interaction.isButton()) return;

    const buttonId = interaction.customId;

    if (!buttonId.startsWith('family_decline_')) return;

    const requestId = parseInt(buttonId.replace('family_decline_', ''));

    try {
      const db = await getDb();
      const request = await db
        .select()
        .from(familyPendingRequests)
        .where(eq(familyPendingRequests.id, requestId))
        .limit(1);

      if (request.length === 0) {
        await interaction.reply({
          content: '❌ This request has expired or been deleted.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const req = request[0];

      if (req.toUserId !== interaction.user.id) {
        await interaction.reply({
          content: '❌ This request is not for you.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const container = moduleContainer('family');
      addText(container, `### Request Declined\n<@${req.toUserId}> has declined the request from <@${req.fromUserId}>.`);

      await interaction.update({
        ...v2Payload([container]),
      });

      await deletePendingRequest(requestId);
    } catch (error) {
      logger.error('Error declining family request:', error);
      await interaction.reply({
        content: '❌ An error occurred processing your request.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

const cleanupHandler: ModuleEvent = {
  event: 'ready',
  handler: async () => {
    setInterval(async () => {
      try {
        const db = await getDb();
        await db.delete(familyPendingRequests).where(lt(familyPendingRequests.expiresAt, new Date()));
        logger.debug('Cleaned up expired family requests');
      } catch (error) {
        logger.error('Error cleaning up expired requests:', error);
      }
    }, 5 * 60 * 1000);
  },
};

export const familyEvents: ModuleEvent[] = [familyAcceptHandler, familyDeclineHandler, cleanupHandler];
