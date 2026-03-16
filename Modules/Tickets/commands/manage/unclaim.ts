import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { isTicketChannel, getTicketConfig } from '../../helpers';
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
  permissionPath: 'tickets.unclaim',
  premiumFeature: 'tickets.basic',
  data: new SlashCommandBuilder()
    .setName('ticket-unclaim')
    .setDescription('Release a claimed ticket'),

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
        content: '❌ Only the staff member who claimed this ticket or an admin can unclaim it.',
      });
    }

    try {
      const db = getDb();

      // Update database
      await db
        .update(tickets)
        .set({ claimedBy: null })
        .where(eq(tickets.channelId, interaction.channel.id));

      // Update cache
      const cacheKey = `ticket:channel:${interaction.guildId!}:${interaction.channel.id}`;
      const updatedTicketData = { ...ticketData, claimedBy: undefined };
      cache.set(cacheKey, updatedTicketData, 3600);

      // Send success container
      const successContainer = moduleContainer('tickets');
      addText(successContainer, '### ✅ Ticket Unclaimed');
      addText(successContainer, 'This ticket is now unclaimed and available for other staff.');

      await interaction.editReply(v2Payload([successContainer]));

      // Log in channel
      const logContainer = moduleContainer('tickets');
      addText(logContainer, '### ⚠️ Ticket Unclaimed');
      addText(logContainer, `This ticket has been unclaimed by ${interaction.user}.`);

      const channel = interaction.channel as any;
      if (channel?.send) {
        await channel.send(v2Payload([logContainer]));
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
