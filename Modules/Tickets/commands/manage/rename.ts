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

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.rename',
  premiumFeature: 'tickets.basic',
  data: new SlashCommandBuilder()
    .setName('ticket-rename')
    .setDescription('Rename the current ticket channel')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('New channel name (max 100 characters)')
        .setRequired(true)
        .setMaxLength(100)
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
        content: '❌ Only staff can rename tickets.',
      });
    }

    const newName = interaction.options.getString('name', true);

    try {
      // Sanitize name for Discord channel naming
      const sanitizedName = newName
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100);

      // Ensure not empty
      if (!sanitizedName) {
        return interaction.editReply({
          content: '❌ Invalid channel name. Please use alphanumeric characters.',
        });
      }

      // Rename the channel
      await (interaction.channel as any).setName(sanitizedName);

      // Send success container
      const successContainer = moduleContainer('tickets');
      addText(successContainer, '### ✅ Ticket Renamed');
      addText(successContainer, `The ticket channel has been renamed to **${sanitizedName}**.`);

      await interaction.editReply(v2Payload([successContainer]));

      // Log in channel
      const logContainer = moduleContainer('tickets');
      addText(logContainer, `${interaction.user} renamed the ticket to **${sanitizedName}**.`);

      const channel = interaction.channel as any;
      if (channel?.send) {
        await channel.send(v2Payload([logContainer]));
      }
    } catch (error) {
      console.error('Error renaming ticket channel:', error);
      return interaction.editReply({
        content: '❌ Failed to rename ticket channel.',
      });
    }
  },
};

export default command;
