import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { isTicketChannel, getTicketConfig } from '../../helpers';
import { Colors } from '../../../../Shared/src/utils/embed';
import { getDb, getRedis } from '../../../../Shared/src/database/connection';
import { tickets } from '../../../../Shared/src/database/models/schema';
import { eq } from 'drizzle-orm';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.unclaim',
  premiumFeature: 'tickets.basic',
  data: new SlashCommandBuilder()
    .setName('ticket-unclaim')
    .setDescription('Release a claimed ticket'),

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

    // Check if claim system is enabled
    if (!config.claimEnabled) {
      return interaction.reply({
        content: '❌ The claim system is not enabled on this server.',
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
        content: '❌ Only the staff member who claimed this ticket or an admin can unclaim it.',
      });
    }

    try {
      const db = getDb();
      const redis = getRedis();

      // Update database
      await db
        .update(tickets)
        .set({ claimedBy: null })
        .where(eq(tickets.channelId, interaction.channel.id));

      // Update cache
      const cacheKey = `ticket:channel:${interaction.guildId!}:${interaction.channel.id}`;
      const updatedTicketData = { ...ticketData, claimedBy: undefined };
      await redis.setex(cacheKey, 3600, JSON.stringify(updatedTicketData));

      // Send success embed
      const embed = new EmbedBuilder()
        .setColor(Colors.Success)
        .setTitle('Ticket Unclaimed')
        .setDescription('This ticket is now unclaimed and available for other staff.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Log in channel
      const logEmbed = new EmbedBuilder()
        .setColor(Colors.Warning)
        .setTitle('Ticket Unclaimed')
        .setDescription(`This ticket has been unclaimed by ${interaction.user}.`)
        .setTimestamp();

      const channel = interaction.channel as any;
      if (channel?.send) {
        await channel.send({ embeds: [logEmbed] });
      }
    } catch (error) {
      console.error('Error unclaiming ticket:', error);
      return interaction.editReply({
        content: '❌ Failed to unclaim ticket.',
      });
    }
  },
};

export default command;
