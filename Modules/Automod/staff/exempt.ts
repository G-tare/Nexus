import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFields, addSeparator, successReply, errorReply, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getAutomodConfig, AutomodConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

const command: BotCommand = {
  module: 'automod',
  permissionPath: 'automod.staff.exempt',
  allowDM: false,
  defaultPermissions: PermissionFlagsBits.ManageGuild,
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('automod-exempt')
    .setDescription('Manage automod exemptions for roles, channels, and users')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add-role')
        .setDescription('Exempt a role from automod')
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Role to exempt')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove-role')
        .setDescription('Remove role exemption')
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Role to remove exemption from')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('add-channel')
        .setDescription('Exempt a channel from automod')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to exempt')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove-channel')
        .setDescription('Remove channel exemption')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to remove exemption from')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('add-user')
        .setDescription('Exempt a user from automod')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('User to exempt')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove-user')
        .setDescription('Remove user exemption')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('User to remove exemption from')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all current exemptions')
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      const config = await getAutomodConfig(guildId);
      const subcommand = interaction.options.getSubcommand();

      // Initialize arrays if they don't exist
      if (!config.exemptRoles) config.exemptRoles = [];
      if (!config.exemptChannels) config.exemptChannels = [];
      if (!config.exemptUsers) config.exemptUsers = [];

      let updated = false;

      switch (subcommand) {
        case 'add-role': {
          const role = interaction.options.getRole('role', true);
          if (config.exemptRoles.includes(role.id)) {
            await interaction.editReply(errorReply('Already Exempt', `${role.name} is already exempt from automod.`));
          } else {
            config.exemptRoles.push(role.id);
            updated = true;
            await interaction.editReply(successReply('Role Exempted', `${role.name} has been exempted from automod.`));
          }
          break;
        }

        case 'remove-role': {
          const role = interaction.options.getRole('role', true);
          const index = config.exemptRoles.indexOf(role.id);
          if (index === -1) {
            await interaction.editReply(errorReply('Not Exempt', `${role.name} is not currently exempt from automod.`));
          } else {
            config.exemptRoles.splice(index, 1);
            updated = true;
            await interaction.editReply(successReply('Exemption Removed', `${role.name} is no longer exempt from automod.`));
          }
          break;
        }

        case 'add-channel': {
          const channel = interaction.options.getChannel('channel', true);
          if (config.exemptChannels.includes(channel.id)) {
            await interaction.editReply(errorReply('Already Exempt', `${channel.name} is already exempt from automod.`));
          } else {
            config.exemptChannels.push(channel.id);
            updated = true;
            await interaction.editReply(successReply('Channel Exempted', `${channel.name} has been exempted from automod.`));
          }
          break;
        }

        case 'remove-channel': {
          const channel = interaction.options.getChannel('channel', true);
          const index = config.exemptChannels.indexOf(channel.id);
          if (index === -1) {
            await interaction.editReply(errorReply('Not Exempt', `${channel.name} is not currently exempt from automod.`));
          } else {
            config.exemptChannels.splice(index, 1);
            updated = true;
            await interaction.editReply(successReply('Exemption Removed', `${channel.name} is no longer exempt from automod.`));
          }
          break;
        }

        case 'add-user': {
          const user = interaction.options.getUser('user', true);
          if (config.exemptUsers.includes(user.id)) {
            await interaction.editReply(errorReply('Already Exempt', `${user.username} is already exempt from automod.`));
          } else {
            config.exemptUsers.push(user.id);
            updated = true;
            await interaction.editReply(successReply('User Exempted', `${user.username} has been exempted from automod.`));
          }
          break;
        }

        case 'remove-user': {
          const user = interaction.options.getUser('user', true);
          const index = config.exemptUsers.indexOf(user.id);
          if (index === -1) {
            await interaction.editReply(errorReply('Not Exempt', `${user.username} is not currently exempt from automod.`));
          } else {
            config.exemptUsers.splice(index, 1);
            updated = true;
            await interaction.editReply(successReply('Exemption Removed', `${user.username} is no longer exempt from automod.`));
          }
          break;
        }

        case 'list': {
          const container = moduleContainer('automod');
          addText(container, '### Automod Exemptions');
          addText(container, 'All roles, channels, and users currently exempted from automod');
          addSeparator(container, 'small');

          const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

          // Roles
          if (config.exemptRoles.length > 0) {
            const rolesList = config.exemptRoles.map((id) => `<@&${id}>`).join(', ');
            fields.push({ name: 'Exempt Roles', value: rolesList });
          } else {
            fields.push({ name: 'Exempt Roles', value: '*None*' });
          }

          // Channels
          if (config.exemptChannels.length > 0) {
            const channelsList = config.exemptChannels.map((id) => `<#${id}>`).join(', ');
            fields.push({ name: 'Exempt Channels', value: channelsList });
          } else {
            fields.push({ name: 'Exempt Channels', value: '*None*' });
          }

          // Users
          if (config.exemptUsers.length > 0) {
            const usersList = config.exemptUsers.map((id) => `<@${id}>`).join(', ');
            fields.push({ name: 'Exempt Users', value: usersList });
          } else {
            fields.push({ name: 'Exempt Users', value: '*None*' });
          }

          addFields(container, fields);
          await interaction.editReply(v2Payload([container]));
          break;
        }

        default:
          await interaction.editReply(errorReply('Invalid Subcommand', 'An error occurred.'));
      }

      if (updated) {
        await moduleConfig.setConfig(guildId, 'automod', config);
      }
    } catch (error) {
      console.error('Error in automod-exempt command:', error);
      await interaction.editReply(errorReply('Command Error', 'An error occurred while processing your request.'));
    }
  },
};

export default command;
