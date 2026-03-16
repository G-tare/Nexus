import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ContainerBuilder,
} from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { closeTicket, isTicketChannel } from '../../helpers';
import { moduleConfig } from '../../../../Shared/src/middleware/moduleConfig';
import {
  moduleContainer,
  addText,
  v2Payload,
} from '../../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.close',
  premiumFeature: 'tickets.basic',
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current ticket')
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for closing (max 1000 characters)')
        .setRequired(false)
        .setMaxLength(1000)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild || !interaction.channel) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const _cfgResult = await moduleConfig.getModuleConfig(interaction.guildId!, 'tickets');
    const config = (_cfgResult?.config ?? {}) as any;

    if (!config?.enabled) {
      return interaction.reply({
        content: '❌ The tickets module is not enabled on this server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Check if this is a ticket channel
    const ticketData = await isTicketChannel(interaction.guildId!, interaction.channel.id);
    if (!ticketData) {
      return interaction.reply({
        content: '❌ This command can only be used in a ticket channel.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const reason = interaction.options.getString('reason') || 'No reason provided';

    // If confirmation is enabled, send confirmation with traditional buttons (not V2 components)
    if (config.closeConfirmation) {
      const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_confirm_close')
          .setLabel('Yes, Close')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('ticket_cancel_close')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

      const confirmMessage = await interaction.editReply({
        content: `❓ **Close Ticket Confirmation**\n\nAre you sure you want to close this ticket?\n\n**Reason:** ${reason}`,
        components: [confirmRow],
      });

      try {
        const collected = await confirmMessage.awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 30000,
          filter: (i) => i.user.id === interaction.user.id,
        });

        if (collected.customId === 'ticket_cancel_close') {
          await collected.deferUpdate();
          return interaction.editReply({
            content: 'Ticket close cancelled.',
            embeds: [],
            components: [],
          });
        }

        // User confirmed close
        try {
          await closeTicket(interaction.channel.id, interaction.guildId!, interaction.user.id, reason);
          return collected.deferUpdate();
        } catch (error) {
          console.error('[Tickets] Error closing ticket:', error);
          return interaction.editReply({
            content: '❌ An error occurred while closing the ticket.',
            embeds: [],
            components: [],
          });
        }
      } catch (error) {
        // Timeout or error
        return interaction.editReply({
          content: '⏱️ Confirmation timed out.',
          embeds: [],
          components: [],
        });
      }
    }

    // No confirmation needed - close directly
    try {
      await closeTicket(interaction.channel.id, interaction.guildId!, interaction.user.id, reason);
      return interaction.editReply('✅ Ticket closed successfully.');
    } catch (error) {
      console.error('[Tickets] Error closing ticket:', error);
      return interaction.editReply(
        '❌ An error occurred while closing the ticket.'
      );
    }
  },
};

export default command;
