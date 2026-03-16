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

const PRIORITY_PREFIXES: Record<string, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  urgent: '🔴',
};

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.priority',
  premiumFeature: 'tickets.basic',
  data: new SlashCommandBuilder()
    .setName('ticket-priority')
    .setDescription('Set the priority level of the current ticket')
    .addStringOption((option) =>
      option
        .setName('level')
        .setDescription('Priority level')
        .setRequired(true)
        .addChoices(
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' },
          { name: 'Urgent', value: 'urgent' }
        )
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

    // Check if priority system is enabled
    if (!config.priorityEnabled) {
      return interaction.reply({
        content: '❌ The priority system is not enabled on this server.',
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
        content: '❌ Only staff can set ticket priority.',
      });
    }

    const priorityLevel = interaction.options.getString('level', true) as 'low' | 'medium' | 'high' | 'urgent';

    try {
      const db = getDb();

      // Update database
      await db
        .update(tickets)
        .set({ priority: priorityLevel })
        .where(eq(tickets.channelId, interaction.channel.id));

      // Update cache
      const cacheKey = `ticket:channel:${interaction.guildId!}:${interaction.channel.id}`;
      const updatedTicketData = { ...ticketData, priority: priorityLevel };
      cache.set(cacheKey, updatedTicketData, 3600);

      // Get current channel name and update prefix if needed
      const prefix = PRIORITY_PREFIXES[priorityLevel];
      const currentName = (interaction.channel as any).name;

      // Remove old priority prefixes if present
      let newName = currentName;
      for (const oldPrefix of Object.values(PRIORITY_PREFIXES)) {
        newName = newName.replace(new RegExp(`^${oldPrefix}\\s*`), '');
      }

      // Add new prefix
      newName = `${prefix}${newName.startsWith('-') ? newName : '-' + newName}`;

      // Sanitize and ensure valid length
      newName = newName
        .toLowerCase()
        .substring(0, 100);

      // Rename the channel if name changed
      if (newName !== currentName) {
        await (interaction.channel as any).setName(newName);
      }

      // Send success container
      const successContainer = moduleContainer('tickets');
      addText(successContainer, '### ✅ Priority Updated');
      addText(successContainer, `Priority set to **${priorityLevel.toUpperCase()}** ${prefix}`);

      await interaction.editReply(v2Payload([successContainer]));

      // Log in channel
      const logContainer = moduleContainer('tickets');
      addText(logContainer, '### Priority Changed');
      addText(logContainer, `${interaction.user} set the ticket priority to **${priorityLevel.toUpperCase()}** ${prefix}`);

      const channel = interaction.channel as any;
      if (channel?.send) {
        await channel.send(v2Payload([logContainer]));
      }
    } catch (error) {
      console.error('Error setting ticket priority:', error);
      return interaction.editReply({
        content: '❌ Failed to update ticket priority.',
      });
    }
  },
};

export default command;
