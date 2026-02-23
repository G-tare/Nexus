import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { isTicketChannel, isTicketStaff, getTicketConfig } from '../../helpers';
import { Colors } from '../../../../Shared/src/utils/embed';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.add',
  premiumFeature: 'tickets.basic',
  data: new SlashCommandBuilder()
    .setName('ticket-add')
    .setDescription('Add a user to the current ticket')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to add to the ticket')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild || !interaction.channel) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
    }

    const config = await getTicketConfig(interaction.guildId!);

    if (!config?.enabled) {
      return interaction.reply({
        content: '❌ The tickets module is not enabled on this server.',
        ephemeral: true,
      });
    }

    // Check if this is a ticket channel
    const ticketData = await isTicketChannel(interaction.guildId!, interaction.channel.id);
    if (!ticketData) {
      return interaction.reply({
        content: '❌ This command can only be used in a ticket channel.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // Check if user has permission (ticket opener or staff)
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isStaff = isTicketStaff(member, config, ticketData.categoryId);
    const isOpener = interaction.user.id === ticketData.userId;

    if (!isStaff && !isOpener) {
      return interaction.editReply({
        content: '❌ Only the ticket opener or staff can add users to this ticket.',
      });
    }

    const targetUser = interaction.options.getUser('user', true);

    try {
      // Add view and send permissions to the channel
      await (interaction.channel as any).permissionOverwrites.edit(targetUser.id, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true,
        EmbedLinks: true,
      });

      // Send success embed
      const embed = new EmbedBuilder()
        .setColor(Colors.Success)
        .setTitle('User Added to Ticket')
        .setDescription(`${targetUser} has been added to the ticket.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Log in channel
      const logEmbed = new EmbedBuilder()
        .setColor(Colors.Info)
        .setDescription(`${interaction.user} added ${targetUser} to the ticket.`)
        .setTimestamp();

      const channel = interaction.channel as any;
      if (channel?.send) {
        await channel.send({ embeds: [logEmbed] });
      }
    } catch (error) {
      console.error('Error adding user to ticket:', error);
      return interaction.editReply({
        content: '❌ Failed to add user to ticket.',
      });
    }
  },
};

export default command;
