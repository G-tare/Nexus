import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder, MessageFlags } from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { moduleConfig } from '../../../../Shared/src/middleware/moduleConfig';
import { Colors, successEmbed, errorEmbed, warningEmbed, infoEmbed } from '../../../../Shared/src/utils/embed';
import type { TicketConfig } from '../../helpers';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.staff.config',
  defaultPermissions: [PermissionFlagsBits.ManageGuild],
  data: new SlashCommandBuilder()
    .setName('ticket-config')
    .setDescription('Configure ticket system settings')
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View all ticket configuration settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-tickets')
        .setDescription('Set maximum open tickets per user')
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('Max open tickets (0 = unlimited)')
            .setMinValue(0)
            .setMaxValue(25)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('auto-close')
        .setDescription('Configure automatic ticket closing')
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable auto-close')
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('hours')
            .setDescription('Hours of inactivity before closing')
            .setMinValue(1)
            .setMaxValue(720)
            .setRequired(false)
        )
        .addIntegerOption((option) =>
          option
            .setName('warning-hours')
            .setDescription('Hours before close to send warning')
            .setMinValue(1)
            .setMaxValue(72)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('close-behavior')
        .setDescription('Configure close behavior')
        .addBooleanOption((option) =>
          option
            .setName('confirm')
            .setDescription('Require confirmation before closing')
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName('delete')
            .setDescription('Delete channel on close')
            .setRequired(false)
        )
        .addIntegerOption((option) =>
          option
            .setName('delay')
            .setDescription('Seconds to wait before deleting')
            .setMinValue(0)
            .setMaxValue(60)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('claim-toggle')
        .setDescription('Toggle the claim system')
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable claim system')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('priority-toggle')
        .setDescription('Toggle the priority system')
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable priority system')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('transcript-toggle')
        .setDescription('Toggle automatic transcripts')
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable transcripts')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('feedback-toggle')
        .setDescription('Toggle the feedback system')
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable feedback')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('log-channel')
        .setDescription('Set the ticket log channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Log channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('add-category')
        .setDescription('Add a ticket category')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Category name')
            .setRequired(true)
            .setMaxLength(50)
        )
        .addStringOption((option) =>
          option
            .setName('emoji')
            .setDescription('Category emoji')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Category description')
            .setRequired(false)
            .setMaxLength(200)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove-category')
        .setDescription('Remove a category')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Category name to remove')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('edit-category')
        .setDescription('Edit a category')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Category to edit')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('new-name')
            .setDescription('New name for category')
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName('staff-role')
            .setDescription('Staff role for this category')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('naming-format')
            .setDescription('Channel naming format')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('welcome-message')
            .setDescription('Welcome message for category')
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
      });
    }

    // Check permission
    const permissions = interaction.member?.permissions;
    if (typeof permissions === 'string' || !permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '❌ You need the Manage Guild permission.',
      });
    }

    const _cfgResult = await moduleConfig.getModuleConfig(interaction.guildId!, 'tickets');
    const config = (_cfgResult?.config ?? {}) as TicketConfig;

    if (!config?.enabled) {
      return interaction.reply({
        content: '❌ Tickets module is not enabled.',
      });
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'view':
        return handleView(interaction, config);
      case 'max-tickets':
        return handleMaxTickets(interaction, config, interaction.guildId!);
      case 'auto-close':
        return handleAutoClose(interaction, config, interaction.guildId!);
      case 'close-behavior':
        return handleCloseBehavior(interaction, config, interaction.guildId!);
      case 'claim-toggle':
        return handleClaimToggle(interaction, config, interaction.guildId!);
      case 'priority-toggle':
        return handlePriorityToggle(interaction, config, interaction.guildId!);
      case 'transcript-toggle':
        return handleTranscriptToggle(interaction, config, interaction.guildId!);
      case 'feedback-toggle':
        return handleFeedbackToggle(interaction, config, interaction.guildId!);
      case 'log-channel':
        return handleLogChannel(interaction, config, interaction.guildId!);
      case 'add-category':
        return handleAddCategory(interaction, config, interaction.guildId!);
      case 'remove-category':
        return handleRemoveCategory(interaction, config, interaction.guildId!);
      case 'edit-category':
        return handleEditCategory(interaction, config, interaction.guildId!);
      default:
        return interaction.reply({
          content: '❌ Unknown subcommand.',
        });
    }
  },
};

async function handleView(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig
) {
  const embed = new EmbedBuilder()
    .setColor(Colors.Primary)
    .setTitle('Ticket Configuration')
    .addFields(
      {
        name: 'Max Tickets Per User',
        value: config.maxOpenTicketsPerUser === 0 ? 'Unlimited' : config.maxOpenTicketsPerUser.toString(),
        inline: true,
      },
      {
        name: 'Claim System',
        value: config.claimEnabled ? '✅ Enabled' : '❌ Disabled',
        inline: true,
      },
      {
        name: 'Priority System',
        value: config.priorityEnabled ? '✅ Enabled' : '❌ Disabled',
        inline: true,
      },
      {
        name: 'Transcripts',
        value: config.transcriptEnabled ? '✅ Enabled' : '❌ Disabled',
        inline: true,
      },
      {
        name: 'Feedback System',
        value: config.feedbackEnabled ? '✅ Enabled' : '❌ Disabled',
        inline: true,
      },
      {
        name: 'Close Confirmation',
        value: config.closeConfirmation ? '✅ Enabled' : '❌ Disabled',
        inline: true,
      },
      {
        name: 'Auto-Close',
        value: config.autoCloseEnabled ? `✅ After ${config.autoCloseHours}h` : '❌ Disabled',
        inline: true,
      },
      {
        name: 'Delete on Close',
        value: config.deleteOnClose ? `✅ Yes (${config.closeDelay}s delay)` : '❌ No',
        inline: true,
      },
      {
        name: 'Categories',
        value: config.categories.length.toString(),
        inline: true,
      }
    );

  return interaction.reply({
    embeds: [embed],
  });
}

async function handleMaxTickets(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  const limit = interaction.options.getInteger('limit', true);
  config.maxOpenTicketsPerUser = limit;
  moduleConfig.setConfig(guildId, 'tickets', config);

  const text = limit === 0 ? 'unlimited' : `${limit} open ticket(s)`;
  const embed = successEmbed(
    'Max Tickets Updated',
    `Users can now have ${text}.`
  );

  return interaction.reply({
    embeds: [embed],
  });
}

async function handleAutoClose(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  const enabled = interaction.options.getBoolean('enabled', true);
  const hours = interaction.options.getInteger('hours');
  const warningHours = interaction.options.getInteger('warning-hours');

  config.autoCloseEnabled = enabled;
  if (hours !== null) config.autoCloseHours = hours;
  if (warningHours !== null) config.autoCloseWarningHours = warningHours;

  moduleConfig.setConfig(guildId, 'tickets', config);

  const desc = enabled
    ? `Auto-close enabled after ${config.autoCloseHours} hours of inactivity. Warning at ${config.autoCloseWarningHours} hours.`
    : 'Auto-close disabled.';

  const embed = successEmbed('Auto-Close Updated', desc);

  return interaction.reply({
    embeds: [embed],
  });
}

async function handleCloseBehavior(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  const confirm = interaction.options.getBoolean('confirm');
  const deleteOnClose = interaction.options.getBoolean('delete');
  const delay = interaction.options.getInteger('delay');

  if (confirm !== null) config.closeConfirmation = confirm;
  if (deleteOnClose !== null) config.deleteOnClose = deleteOnClose;
  if (delay !== null) config.closeDelay = delay;

  moduleConfig.setConfig(guildId, 'tickets', config);

  const desc = `Confirmation: ${config.closeConfirmation ? '✅' : '❌'}\nDelete on close: ${config.deleteOnClose ? `✅ (${config.closeDelay}s)` : '❌'}`;

  const embed = successEmbed('Close Behavior Updated', desc);

  return interaction.reply({
    embeds: [embed],
  });
}

async function handleClaimToggle(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  config.claimEnabled = interaction.options.getBoolean('enabled', true);
  moduleConfig.setConfig(guildId, 'tickets', config);

  const embed = successEmbed(
    'Claim System',
    config.claimEnabled ? '✅ Enabled' : '❌ Disabled'
  );

  return interaction.reply({
    embeds: [embed],
  });
}

async function handlePriorityToggle(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  config.priorityEnabled = interaction.options.getBoolean('enabled', true);
  moduleConfig.setConfig(guildId, 'tickets', config);

  const embed = successEmbed(
    'Priority System',
    config.priorityEnabled ? '✅ Enabled' : '❌ Disabled'
  );

  return interaction.reply({
    embeds: [embed],
  });
}

async function handleTranscriptToggle(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  config.transcriptEnabled = interaction.options.getBoolean('enabled', true);
  moduleConfig.setConfig(guildId, 'tickets', config);

  const embed = successEmbed(
    'Transcripts',
    config.transcriptEnabled ? '✅ Enabled' : '❌ Disabled'
  );

  return interaction.reply({
    embeds: [embed],
  });
}

async function handleFeedbackToggle(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  config.feedbackEnabled = interaction.options.getBoolean('enabled', true);
  moduleConfig.setConfig(guildId, 'tickets', config);

  const embed = successEmbed(
    'Feedback System',
    config.feedbackEnabled ? '✅ Enabled' : '❌ Disabled'
  );

  return interaction.reply({
    embeds: [embed],
  });
}

async function handleLogChannel(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  const channel = interaction.options.getChannel('channel', true);
  config.logChannelId = channel.id;
  moduleConfig.setConfig(guildId, 'tickets', config);

  const embed = successEmbed(
    'Log Channel Set',
    `Ticket logs will be posted to ${channel.toString()}`
  );

  return interaction.reply({
    embeds: [embed],
  });
}

async function handleAddCategory(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  const name = interaction.options.getString('name', true);
  const emoji = interaction.options.getString('emoji');
  const description = interaction.options.getString('description');

  // Check if category already exists
  if (config.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return interaction.reply({
      content: '❌ A category with that name already exists.',
    });
  }

  config.categories.push({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    emoji: emoji || undefined,
    description: description || undefined,
    staffRoles: [],
    namingFormat: 'ticket-{number}',
    claimEnabled: true,
  });

  moduleConfig.setConfig(guildId, 'tickets', config);

  const embed = successEmbed(
    'Category Added',
    `${emoji || ''} **${name}** has been added to the ticket system.`
  );

  return interaction.reply({
    embeds: [embed],
  });
}

async function handleRemoveCategory(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  const name = interaction.options.getString('name', true);

  const index = config.categories.findIndex(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );

  if (index === -1) {
    return interaction.reply({
      content: '❌ Category not found.',
    });
  }

  if (config.categories.length === 1) {
    return interaction.reply({
      content: '❌ You must have at least one category.',
    });
  }

  const removed = config.categories.splice(index, 1)[0];
  moduleConfig.setConfig(guildId, 'tickets', config);

  const embed = successEmbed(
    'Category Removed',
    `**${removed.name}** has been removed.`
  );

  return interaction.reply({
    embeds: [embed],
  });
}

async function handleEditCategory(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  const name = interaction.options.getString('name', true);
  const newName = interaction.options.getString('new-name');
  const staffRole = interaction.options.getRole('staff-role');
  const namingFormat = interaction.options.getString('naming-format');
  const welcomeMessage = interaction.options.getString('welcome-message');

  const category = config.categories.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );

  if (!category) {
    return interaction.reply({
      content: '❌ Category not found.',
    });
  }

  if (newName) category.name = newName;
  if (staffRole) {
    if (!category.staffRoles.includes(staffRole.id)) {
      category.staffRoles.push(staffRole.id);
    }
  }
  if (namingFormat) category.namingFormat = namingFormat;
  if (welcomeMessage) category.welcomeMessage = welcomeMessage;

  moduleConfig.setConfig(guildId, 'tickets', config);

  const embed = successEmbed('Category Updated', `**${category.name}** has been updated.`);

  return interaction.reply({
    embeds: [embed],
  });
}

export default command;
