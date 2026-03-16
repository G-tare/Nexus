import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { isTicketChannel, isTicketStaff, getTicketConfig } from '../../helpers';
import {
  moduleContainer,
  addText,
  v2Payload,
} from '../../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.remove',
  premiumFeature: 'tickets.basic',
  data: new SlashCommandBuilder()
    .setName('ticket-remove')
    .setDescription('Remove a user from the current ticket')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to remove from the ticket')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild || !interaction.channel) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
      });
    }

    const config = await getTicketConfig(interaction.guildId!);

    if (!config?.enabled) {
      return interaction.reply({
        content: '❌ The tickets module is not enabled on this server.',
      });
    }

    // Check if this is a ticket channel
    const ticketData = await isTicketChannel(interaction.guildId!, interaction.channel.id);
    if (!ticketData) {
      return interaction.reply({
        content: '❌ This command can only be used in a ticket channel.',
      });
    }

    await interaction.deferReply({});

    // Check if user has permission (staff only)
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isStaff = isTicketStaff(member, config, ticketData.categoryId);

    if (!isStaff) {
      return interaction.editReply({
        content: '❌ Only staff can remove users from tickets.',
      });
    }

    const targetUser = interaction.options.getUser('user', true);

    // Cannot remove ticket opener or staff members
    if (targetUser.id === ticketData.userId) {
      return interaction.editReply({
        content: '❌ You cannot remove the ticket opener.',
      });
    }

    // Check if target is staff
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember && isTicketStaff(targetMember, config, ticketData.categoryId)) {
      return interaction.editReply({
        content: '❌ You cannot remove staff members from tickets.',
      });
    }

    try {
      // Remove permissions from the channel
      await (interaction.channel as any).permissionOverwrites.delete(targetUser.id);

      // Send success container
      const successContainer = moduleContainer('tickets');
      addText(successContainer, '### ✅ User Removed from Ticket');
      addText(successContainer, `${targetUser} has been removed from the ticket.`);

      await interaction.editReply(v2Payload([successContainer]));

      // Log in channel
      const logContainer = moduleContainer('tickets');
      addText(logContainer, `${interaction.user} removed ${targetUser} from the ticket.`);

      const channel = interaction.channel as any;
      if (channel?.send) {
        await channel.send(v2Payload([logContainer]));
      }
    } catch (error) {
      console.error('Error removing user from ticket:', error);
      return interaction.editReply({
        content: '❌ Failed to remove user from ticket.',
      });
    }
  },
};

export default command;
