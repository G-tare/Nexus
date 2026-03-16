import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ContainerBuilder,
  MessageFlags,
} from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { moduleConfig } from '../../../../Shared/src/middleware/moduleConfig';
import {
  moduleContainer,
  addText,
  addFields,
  successContainer,
  v2Payload,
} from '../../../../Shared/src/utils/componentsV2';
import type { TicketConfig } from '../../helpers';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.staff.staffrole',
  defaultPermissions: [PermissionFlagsBits.ManageGuild],
  data: new SlashCommandBuilder()
    .setName('ticket-staffrole')
    .setDescription('Manage ticket staff roles')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a global ticket staff role')
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Role to add as staff')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a global ticket staff role')
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Role to remove from staff')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List all ticket staff roles')
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
    const config = (_cfgResult?.config ?? {}) as any;

    if (!config?.enabled) {
      return interaction.reply({
        content: '❌ Tickets module is not enabled.',
      });
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        return handleAdd(interaction, config, interaction.guildId!);
      case 'remove':
        return handleRemove(interaction, config, interaction.guildId!);
      case 'list':
        return handleList(interaction, config, interaction.guild);
      default:
        return interaction.reply({
          content: '❌ Unknown subcommand.',
        });
    }
  },
};

async function handleAdd(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  const role = interaction.options.getRole('role', true);

  // Check if already added
  if (config.globalStaffRoles.includes(role.id)) {
    return interaction.reply({
      content: `❌ ${role.toString()} is already a staff role.`,
    });
  }

  config.globalStaffRoles.push(role.id);
  moduleConfig.setConfig(guildId, 'tickets', config);

  const container = successContainer(
    'Staff Role Added',
    `${role.toString()} is now a ticket staff role.`
  );

  return interaction.reply(v2Payload([container]));
}

async function handleRemove(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  const role = interaction.options.getRole('role', true);

  const index = config.globalStaffRoles.indexOf(role.id);

  if (index === -1) {
    return interaction.reply({
      content: `❌ ${role.toString()} is not a staff role.`,
    });
  }

  config.globalStaffRoles.splice(index, 1);
  moduleConfig.setConfig(guildId, 'tickets', config);

  const container = successContainer(
    'Staff Role Removed',
    `${role.toString()} is no longer a staff role.`
  );

  return interaction.reply(v2Payload([container]));
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guild: any
) {
  const container = moduleContainer('tickets');
  addText(container, '### Ticket Staff Roles');

  const fields = [];

  // Global staff roles
  if (config.globalStaffRoles.length > 0) {
    const globalRoles = config.globalStaffRoles
      .map((id) => {
        const role = guild.roles.cache.get(id);
        return role ? role.toString() : `<@&${id}>`;
      })
      .join('\n');

    fields.push({
      name: 'Global Staff Roles',
      value: globalRoles,
      inline: false,
    });
  } else {
    fields.push({
      name: 'Global Staff Roles',
      value: 'None configured',
      inline: false,
    });
  }

  // Category-specific staff roles
  if (config.categories.some((c) => c.staffRoles.length > 0)) {
    for (const category of config.categories) {
      if (category.staffRoles.length > 0) {
        const categoryRoles = category.staffRoles
          .map((id) => {
            const role = guild.roles.cache.get(id);
            return role ? role.toString() : `<@&${id}>`;
          })
          .join('\n');

        fields.push({
          name: `${category.emoji || ''} ${category.name}`,
          value: categoryRoles,
          inline: false,
        });
      }
    }
  }

  if (fields.length > 0) {
    addFields(container, fields);
  }

  return interaction.reply(v2Payload([container]));
}

export default command;
