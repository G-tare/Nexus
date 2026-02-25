import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { isTicketChannel, isTicketStaff, getTicketConfig } from '../../helpers';
import { Colors } from '../../../../Shared/src/utils/embed';
import { getDb, getRedis } from '../../../../Shared/src/database/connection';
import { tickets } from '../../../../Shared/src/database/models/schema';
import { eq } from 'drizzle-orm';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.transfer',
  premiumFeature: 'tickets.basic',
  data: new SlashCommandBuilder()
    .setName('ticket-transfer')
    .setDescription('Transfer ticket to another staff member')
    .addUserOption((option) =>
      option
        .setName('staff')
        .setDescription('Staff member to transfer the ticket to')
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

    // Check if claim system is enabled
    if (!config.claimEnabled) {
      return interaction.reply({
        content: '❌ The claim system is not enabled on this server.',
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

    // Check if user has permission (must be claimer or admin)
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

    if (!ticketData.claimedBy) {
      return interaction.editReply({
        content: '❌ This ticket is not currently claimed.',
      });
    }

    if (interaction.user.id !== ticketData.claimedBy && !isAdmin) {
      return interaction.editReply({
        content: '❌ Only the staff member who claimed this ticket or an admin can transfer it.',
      });
    }

    const targetUser = interaction.options.getUser('staff', true);

    // Check if target is staff
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.editReply({
        content: '❌ User is not in the server.',
      });
    }

    if (!isTicketStaff(targetMember, config, ticketData.categoryId)) {
      return interaction.editReply({
        content: '❌ Target user is not a staff member.',
      });
    }

    // Cannot transfer to self
    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({
        content: '❌ You cannot transfer a ticket to yourself.',
      });
    }

    try {
      const db = getDb();
      const redis = getRedis();

      // Update database
      await db
        .update(tickets)
        .set({ claimedBy: targetUser.id })
        .where(eq(tickets.channelId, interaction.channel.id));

      // Update cache
      const cacheKey = `ticket:channel:${interaction.guildId!}:${interaction.channel.id}`;
      const updatedTicketData = { ...ticketData, claimedBy: targetUser.id };
      await redis.setex(cacheKey, 3600, JSON.stringify(updatedTicketData));

      // Send success embed
      const embed = new EmbedBuilder()
        .setColor(Colors.Success)
        .setTitle('Ticket Transferred')
        .setDescription(`This ticket has been transferred to ${targetUser}.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Log in channel
      const logEmbed = new EmbedBuilder()
        .setColor(Colors.Info)
        .setTitle('Ticket Transferred')
        .setDescription(`${interaction.user} transferred this ticket to ${targetUser}.`)
        .setTimestamp();

      const channel = interaction.channel as any;
      if (channel?.send) {
        await channel.send({ embeds: [logEmbed] });
      }
    } catch (error) {
      console.error('Error transferring ticket:', error);
      return interaction.editReply({
        content: '❌ Failed to transfer ticket.',
      });
    }
  },
};

export default command;
