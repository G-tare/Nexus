import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { isTicketChannel, isTicketStaff, getTicketConfig } from '../../helpers';
import { Colors } from '../../../../Shared/src/utils/embed';
import { getDb, getRedis } from '../../../../Shared/src/database/connection';
import { tickets } from '../../../../Shared/src/database/models/schema';
import { eq } from 'drizzle-orm';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.claim',
  premiumFeature: 'tickets.basic',
  data: new SlashCommandBuilder()
    .setName('ticket-claim')
    .setDescription('Claim the current ticket'),

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

    // Check if user has permission (staff only)
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isStaff = isTicketStaff(member, config, ticketData.categoryId);

    if (!isStaff) {
      return interaction.editReply({
        content: '❌ Only staff can claim tickets.',
      });
    }

    // Check if already claimed
    if (ticketData.claimedBy) {
      const claimer = await interaction.guild.members.fetch(ticketData.claimedBy).catch(() => null);
      return interaction.editReply({
        content: `❌ This ticket is already claimed by ${claimer?.user.username || ticketData.claimedBy}.`,
      });
    }

    try {
      const db = getDb();
      const redis = getRedis();

      // Update database
      await db
        .update(tickets)
        .set({ claimedBy: interaction.user.id })
        .where(eq(tickets.channelId, interaction.channel.id));

      // Update cache
      const cacheKey = `ticket:channel:${interaction.guildId!}:${interaction.channel.id}`;
      const updatedTicketData = { ...ticketData, claimedBy: interaction.user.id };
      await redis.setex(cacheKey, 3600, JSON.stringify(updatedTicketData));

      // Send success embed
      const embed = new EmbedBuilder()
        .setColor(Colors.Success)
        .setTitle('Ticket Claimed')
        .setDescription(`${interaction.user} has claimed this ticket.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Log in channel
      const logEmbed = new EmbedBuilder()
        .setColor(Colors.Info)
        .setTitle('Ticket Claimed')
        .setDescription(`This ticket has been claimed by ${interaction.user}.`)
        .setTimestamp();

      const channel = interaction.channel as any;
      if (channel?.send) {
        await channel.send({ embeds: [logEmbed] });
      }
    } catch (error) {
      console.error('Error claiming ticket:', error);
      return interaction.editReply({
        content: '❌ Failed to claim ticket.',
      });
    }
  },
};

export default command;
