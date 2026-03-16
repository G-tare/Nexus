import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
  TextChannel,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { getDb } from '../../../../Shared/src/database/connection';
import { ticketNotices } from '../../../../Shared/src/database/models/schema';
import {
  moduleContainer,
  addText,
  successContainer,
  v2Payload,
} from '../../../../Shared/src/utils/componentsV2';
import { createModuleLogger } from '../../../../Shared/src/utils/logger';

const logger = createModuleLogger('Tickets:Notice');

// Helper to get ticket ID from channel name or data
async function getTicketIdFromChannel(
  channelName: string,
  guildId: string
): Promise<number | null> {
  try {
    // Extract ticket number from channel name (assuming format like ticket-123)
    const match = channelName.match(/ticket-(\d+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  } catch {
    return null;
  }
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket-notice')
    .setDescription('Post a notice in the current ticket channel')
    .addStringOption((opt) =>
      opt
        .setName('text')
        .setDescription('Notice message')
        .setRequired(true)
    ),

  module: 'tickets',
  permissionPath: 'tickets.manage.notice',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    try {
      const guildId = interaction.guildId!;
      const channel = interaction.channel as TextChannel | null;
      const channelName = channel?.name || '';
      const noticeText = interaction.options.getString('text', true);

      if (!channel) {
        await interaction.editReply({
          content: '❌ Could not access the channel.',
        });
        return;
      }

      // Check if user has staff permission or ManageChannels
      const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);

      if (!isStaff) {
        await interaction.editReply({
          content: '❌ You do not have permission to post notices. Only staff can use this command.',
        });
        return;
      }

      // Verify this is a ticket channel
      if (!channelName.includes('ticket')) {
        await interaction.editReply({
          content: '❌ This command can only be used in a ticket channel.',
        });
        return;
      }

      // Get ticket ID from channel name
      const ticketId = await getTicketIdFromChannel(channelName, guildId);

      if (!ticketId) {
        await interaction.editReply({
          content: '❌ Could not identify the ticket ID from the channel name.',
        });
        return;
      }

      // Create notice container
      const noticeContainer = moduleContainer('tickets');
      addText(noticeContainer, '### 📌 Ticket Notice');
      addText(noticeContainer, noticeText);
      addText(noticeContainer, `-# Posted by ${interaction.user.username}`);

      // Send the notice to the channel
      const noticeMessage = await channel.send(v2Payload([noticeContainer]));

      // Store notice in database
      if (noticeMessage) {
        const db = await getDb();

        try {
          await db
            .insert(ticketNotices)
            .values({
              guildId,
              ticketId,
              authorId: interaction.user.id,
              content: noticeText,
              messageId: noticeMessage.id,
            });
        } catch (dbError) {
          logger.error('Error storing notice in database:', dbError);
          // Continue anyway - the notice was still posted
        }
      }

      // Attempt to pin the notice
      try {
        await noticeMessage?.pin().catch(() => {
          // Pin failed, but continue
        });
      } catch {
        // Silently fail on pin
      }

      // Send confirmation
      const confirmContainer = successContainer(
        'Notice Posted',
        'Your notice has been posted and pinned to this ticket.'
      );

      await interaction.editReply(v2Payload([confirmContainer]));
    } catch (error) {
      logger.error('Error in ticket notice command:', error);
      await interaction.editReply({
        content: 'An error occurred while posting the notice.',
      });
    }
  },
};

export default command;
