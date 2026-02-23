import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { createTicket } from '../../helpers';
import { moduleConfig } from '../../../../Shared/src/middleware/moduleConfig';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.ticket',
  premiumFeature: 'tickets.basic',
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Open a new support ticket')
    .addStringOption((option) =>
      option
        .setName('category')
        .setDescription('Ticket category')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for ticket (max 1000 characters)')
        .setRequired(false)
        .setMaxLength(1000)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
    }

    const _cfgResult = await moduleConfig.getModuleConfig(interaction.guildId!, 'tickets');
    const config = (_cfgResult?.config ?? {}) as any;

    if (!config?.enabled) {
      return interaction.reply({
        content: '❌ The tickets module is not enabled on this server.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // Check if feature is enabled
    if (!config.features?.basic) {
      return interaction.editReply('❌ Ticket creation is not enabled.');
    }

    // Get category from options
    let category = interaction.options.getString('category');
    const reason = interaction.options.getString('reason') || '';

    // If no category provided and multiple exist, ask user to specify
    if (!category && config.categories && config.categories.length > 1) {
      return interaction.editReply(
        '❌ Multiple categories available. Please specify one using the category option.'
      );
    }

    // If no category provided and exactly one exists, use it
    if (!category && config.categories && config.categories.length === 1) {
      category = config.categories[0].id;
    }

    // Verify category exists
    if (!config.categories?.some((cat: any) => cat.id === category)) {
      return interaction.editReply('❌ Invalid category selected.');
    }

    // Check max open tickets per user
    if (config.maxOpenTickets) {
      const userTickets = (config.tickets || []).filter(
        (t: any) => t.ownerId === interaction.user.id && !t.closedAt
      );
      if (userTickets.length >= config.maxOpenTickets) {
        return interaction.editReply(
          `❌ You have reached the maximum number of open tickets (${config.maxOpenTickets}).`
        );
      }
    }

    try {
      if (!category) {
        return interaction.editReply('❌ No category selected.');
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const ticket = await createTicket(
        interaction.guild,
        member,
        category,
        reason
      );

      if (!ticket) {
        return interaction.editReply('❌ Failed to create ticket. Please try again.');
      }

      return interaction.editReply(
        `✅ Ticket created! <#${ticket.channel}>`
      );
    } catch (error) {
      console.error('[Tickets] Error creating ticket:', error);
      return interaction.editReply(
        '❌ An error occurred while creating your ticket.'
      );
    }
  },

  async autocomplete(interaction) {
    if (!interaction.guildId) return;

    const _cfgResult = await moduleConfig.getModuleConfig(interaction.guildId!, 'tickets');
    const config = (_cfgResult?.config ?? {}) as any;
    const focused = interaction.options.getFocused();

    if (!config?.categories) {
      return interaction.respond([]);
    }

    const filtered = config.categories
      .filter((cat: any) => cat.name.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25)
      .map((cat: any) => ({
        name: cat.name,
        value: cat.id,
      }));

    return interaction.respond(filtered);
  },
};

export default command;
