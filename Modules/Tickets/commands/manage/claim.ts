import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { isTicketChannel, isTicketStaff, getTicketConfig } from '../../helpers';
import {
  moduleContainer,
  addText,
  v2Payload,
} from '../../../../Shared/src/utils/componentsV2';
import { getDb } from '../../../../Shared/src/database/connection';
import { cache } from '../../../../Shared/src/cache/cacheManager';
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

      // Update database
      await db
        .update(tickets)
        .set({ claimedBy: interaction.user.id })
        .where(eq(tickets.channelId, interaction.channel.id));

      // Update cache
      const cacheKey = `ticket:channel:${interaction.guildId!}:${interaction.channel.id}`;
      const updatedTicketData = { ...ticketData, claimedBy: interaction.user.id };
      cache.set(cacheKey, updatedTicketData, 3600);

      // Send success container
      const successContainer = moduleContainer('tickets');
      addText(successContainer, '### ✅ Ticket Claimed');
      addText(successContainer, `${interaction.user} has claimed this ticket.`);

      await interaction.editReply(v2Payload([successContainer]));

      // Log in channel
      const logContainer = moduleContainer('tickets');
      addText(logContainer, '### ✅ Ticket Claimed');
      addText(logContainer, `This ticket has been claimed by ${interaction.user}.`);

      const channel = interaction.channel as any;
      if (channel?.send) {
        await channel.send(v2Payload([logContainer]));
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
