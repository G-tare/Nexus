import { 
  Client,
  Events,
  Interaction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ChannelType,
  TextChannel,
  EmbedBuilder,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { ModuleEvent } from '../../Shared/src/types/command';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import {
  createTicket,
  closeTicket,
  isTicketChannel,
  generateTranscript,
  getTicketConfig,
  isTicketStaff,
} from './helpers';
import { getDb } from '../../Shared/src/database/connection';
import { tickets } from '../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { Colors } from '../../Shared/src/utils/embed';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Tickets');

// ============================================================================
// BUTTON HANDLER
// ============================================================================

const buttonHandler: ModuleEvent = { event: Events.InteractionCreate,
  async handler(interaction: Interaction) {
    if (!interaction.isButton()) return;

    const { customId } = interaction as ButtonInteraction;
    if (!interaction.guildId || !interaction.guild) return;

    const config = await getTicketConfig(interaction.guildId!);
    if (!config.enabled) return;

    // Ticket creation from panel
    if (customId.startsWith('ticket_create_')) {
      if (!interaction.member) return;

      const categoryId = customId.split('ticket_create_')[1];
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const result = await createTicket(
        interaction.guild,
        interaction.member as any,
        categoryId
      );

      if (result) {
        const embed = new EmbedBuilder()
          .setColor(Colors.Success)
          .setTitle('Ticket Created')
          .setDescription(`Your ticket has been created: ${result.channel.toString()}`);

        return interaction.editReply({
          embeds: [embed],
        });
      } else {
        return interaction.editReply({
          content: '❌ Failed to create ticket. Please check if you have reached the maximum number of open tickets.',
        });
      }
    }

    // Close ticket button
    if (customId === 'ticket_close') {
      if (!interaction.channel) return;

      const ticketData = await isTicketChannel(
        interaction.guildId!,
        interaction.channel.id
      );
      if (!ticketData) return;

      const permissions = interaction.member?.permissions;
      if ((typeof permissions === 'string' || !permissions?.has(PermissionFlagsBits.ManageMessages)) && ticketData.userId !== interaction.user.id) {
        return interaction.reply({
          content: '❌ You do not have permission to close this ticket.',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const success = await closeTicket(
        interaction.channel.id,
        interaction.guildId!,
        interaction.user.id
      );

      if (success) {
        return interaction.editReply({
          content: '✅ Ticket closed successfully.',
        });
      } else {
        return interaction.editReply({
          content: '❌ Failed to close ticket.',
        });
      }
    }

    // Claim ticket button
    if (customId === 'ticket_claim') {
      if (!interaction.channel) return;

      const ticketData = await isTicketChannel(
        interaction.guildId!,
        interaction.channel.id
      );
      if (!ticketData || !config.claimEnabled) return;

      if (!isTicketStaff(interaction.member as any, config, ticketData.categoryId)) {
        return interaction.reply({
          content: '❌ Only staff members can claim tickets.',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (ticketData.claimedBy === interaction.user.id) {
        return interaction.reply({
          content: '✅ You have already claimed this ticket.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const db = getDb();
      await db
        .update(tickets)
        .set({ claimedBy: interaction.user.id })
        .where(eq(tickets.channelId, interaction.channel.id));

      const embed = new EmbedBuilder()
        .setColor(Colors.Success)
        .setTitle('Ticket Claimed')
        .setDescription(`${interaction.user.toString()} has claimed this ticket.`);

      await (interaction.channel as TextChannel).send({ embeds: [embed] });

      return interaction.reply({
        content: '✅ You have claimed this ticket.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Transcript button
    if (customId === 'ticket_transcript') {
      if (!interaction.channel) return;

      const ticketData = await isTicketChannel(
        interaction.guildId!,
        interaction.channel.id
      );
      if (!ticketData || !config.transcriptEnabled) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const transcript = await generateTranscript(interaction.channel.id, interaction.guild);
        if (transcript) {
          const fileName = `ticket-${ticketData.ticketNumber}-${Date.now()}.html`;
          return interaction.editReply({
            content: '✅ Transcript generated!',
            files: [{ attachment: Buffer.from(transcript), name: fileName }],
          });
        }
      } catch (error) {
        logger.error('Error generating transcript:', error);
      }

      return interaction.editReply({
        content: '❌ Failed to generate transcript.',
      });
    }

    // Feedback buttons
    if (customId.startsWith('ticket_feedback_')) {
      // TODO: Implement feedback rating properly when ticket context is available
      return interaction.reply({
        content: '✅ Thank you for your feedback!',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Close confirmation
    if (customId === 'ticket_confirm_close') {
      if (!interaction.channel) return;

      const ticketData = await isTicketChannel(
        interaction.guildId!,
        interaction.channel.id
      );
      if (!ticketData) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const success = await closeTicket(
        interaction.channel.id,
        interaction.guildId!,
        interaction.user.id
      );

      if (success) {
        return interaction.editReply({
          content: '✅ Ticket closed successfully.',
        });
      }
    }

    if (customId === 'ticket_cancel_close') {
      return interaction.reply({
        content: '❌ Close cancelled.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

// ============================================================================
// SELECT MENU HANDLER
// ============================================================================

const selectMenuHandler: ModuleEvent = { event: Events.InteractionCreate,
  async handler(interaction: Interaction) {
    if (!interaction.isStringSelectMenu()) return;

    const { customId } = interaction as StringSelectMenuInteraction;
    if (!interaction.guildId || !interaction.guild) return;

    const config = await getTicketConfig(interaction.guildId!);
    if (!config.enabled) return;

    // Ticket panel dropdown
    if (customId === 'ticket_panel_select') {
      if (!interaction.member) return;

      const categoryId = (interaction as StringSelectMenuInteraction).values[0];
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const result = await createTicket(
        interaction.guild,
        interaction.member as any,
        categoryId
      );

      if (result) {
        const embed = new EmbedBuilder()
          .setColor(Colors.Success)
          .setTitle('Ticket Created')
          .setDescription(`Your ticket has been created: ${result.channel.toString()}`);

        return interaction.editReply({
          embeds: [embed],
        });
      } else {
        return interaction.editReply({
          content: '❌ Failed to create ticket.',
        });
      }
    }
  },
};

// ============================================================================
// CHANNEL DELETE HANDLER
// ============================================================================

const channelDeleteHandler: ModuleEvent = { event: Events.ChannelDelete,
  async handler(channel: any) {
    if (!channel.guild) return;

    const db = getDb();

    // Check if this is a ticket channel
    const ticketData = await isTicketChannel(channel.guild.id, channel.id);
    if (!ticketData) return;

    // Mark as closed if not already
    if (ticketData.status === 'open') {
      await db
        .update(tickets)
        .set({ status: 'closed', closedAt: new Date() })
        .where(eq(tickets.channelId, channel.id));

      logger.info(`Ticket channel ${channel.id} was deleted, marking as closed`);
    }
  },
};

// ============================================================================
// AUTO-CLOSE CHECKER
// ============================================================================

const autoCloseChecker: ModuleEvent = { event: Events.ClientReady,
  once: true,
  async handler(client: Client) {
    logger.info('Starting auto-close checker...');

    // Run check every 5 minutes
    setInterval(async () => {
      try {
        const db = getDb();

        // Get all open tickets
        const allTickets = await db.select().from(tickets)
          .where(eq(tickets.status, 'open'));

        for (const ticket of allTickets) {
          if (!ticket.channelId) continue; // Skip tickets without a channel

          const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
          if (!guild) continue;

          const config = await getTicketConfig(ticket.guildId);
          if (!config.autoCloseEnabled) continue;

          const channel = (await guild.channels.fetch(ticket.channelId).catch(() => null)) as TextChannel;
          if (!channel) continue;

          // Get last message timestamp
          const messages = await channel.messages.fetch({ limit: 1 }).catch(() => []);
          const lastMessage = (messages as any).first();

          if (!lastMessage) continue;

          const inactiveHours = (Date.now() - lastMessage.createdTimestamp) / (1000 * 60 * 60);

          // Send warning if approaching close
          if (
            inactiveHours >= config.autoCloseHours - config.autoCloseWarningHours &&
            inactiveHours < config.autoCloseHours
          ) {
            const warnEmbed = new EmbedBuilder()
              .setColor(Colors.Warning)
              .setTitle('Inactivity Warning')
              .setDescription(
                `This ticket will be automatically closed in ${Math.round(
                  config.autoCloseHours - inactiveHours
                )} hours due to inactivity.`
              );

            await (channel as any).send({ embeds: [warnEmbed] }).catch(() => {});
          }

          // Close if past threshold
          if (inactiveHours >= config.autoCloseHours) {
            await closeTicket(ticket.channelId, ticket.guildId, client.user!.id, 'Auto-closed due to inactivity');
            logger.info(`Auto-closed ticket #${ticket.ticketNumber}`);
          }
        }
      } catch (error) {
        logger.error('Error in auto-close checker:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes
  },
};

export const ticketEvents: ModuleEvent[] = [
  buttonHandler,
  selectMenuHandler,
  channelDeleteHandler,
  autoCloseChecker,
];
