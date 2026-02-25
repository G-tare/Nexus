import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
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

      let responseEmbed: EmbedBuilder;
      let updated = false;

      switch (subcommand) {
        case 'add-role': {
          const role = interaction.options.getRole('role', true);
          if (config.exemptRoles.includes(role.id)) {
            responseEmbed = errorEmbed(
              'Already Exempt',
              `${role.name} is already exempt from automod.`
            );
          } else {
            config.exemptRoles.push(role.id);
            updated = true;
            responseEmbed = successEmbed(
              'Role Exempted',
              `${role.name} has been exempted from automod.`
            );
          }
          break;
        }

        case 'remove-role': {
          const role = interaction.options.getRole('role', true);
          const index = config.exemptRoles.indexOf(role.id);
          if (index === -1) {
            responseEmbed = errorEmbed(
              'Not Exempt',
              `${role.name} is not currently exempt from automod.`
            );
          } else {
            config.exemptRoles.splice(index, 1);
            updated = true;
            responseEmbed = successEmbed(
              'Exemption Removed',
              `${role.name} is no longer exempt from automod.`
            );
          }
          break;
        }

        case 'add-channel': {
          const channel = interaction.options.getChannel('channel', true);
          if (config.exemptChannels.includes(channel.id)) {
            responseEmbed = errorEmbed(
              'Already Exempt',
              `${channel.name} is already exempt from automod.`
            );
          } else {
            config.exemptChannels.push(channel.id);
            updated = true;
            responseEmbed = successEmbed(
              'Channel Exempted',
              `${channel.name} has been exempted from automod.`
            );
          }
          break;
        }

        case 'remove-channel': {
          const channel = interaction.options.getChannel('channel', true);
          const index = config.exemptChannels.indexOf(channel.id);
          if (index === -1) {
            responseEmbed = errorEmbed(
              'Not Exempt',
              `${channel.name} is not currently exempt from automod.`
            );
          } else {
            config.exemptChannels.splice(index, 1);
            updated = true;
            responseEmbed = successEmbed(
              'Exemption Removed',
              `${channel.name} is no longer exempt from automod.`
            );
          }
          break;
        }

        case 'add-user': {
          const user = interaction.options.getUser('user', true);
          if (config.exemptUsers.includes(user.id)) {
            responseEmbed = errorEmbed(
              'Already Exempt',
              `${user.username} is already exempt from automod.`
            );
          } else {
            config.exemptUsers.push(user.id);
            updated = true;
            responseEmbed = successEmbed(
              'User Exempted',
              `${user.username} has been exempted from automod.`
            );
          }
          break;
        }

        case 'remove-user': {
          const user = interaction.options.getUser('user', true);
          const index = config.exemptUsers.indexOf(user.id);
          if (index === -1) {
            responseEmbed = errorEmbed(
              'Not Exempt',
              `${user.username} is not currently exempt from automod.`
            );
          } else {
            config.exemptUsers.splice(index, 1);
            updated = true;
            responseEmbed = successEmbed(
              'Exemption Removed',
              `${user.username} is no longer exempt from automod.`
            );
          }
          break;
        }

        case 'list': {
          const embed = new EmbedBuilder()
            .setColor(Colors.Info)
            .setTitle('Automod Exemptions')
            .setDescription(
              'All roles, channels, and users currently exempted from automod'
            );

          // Roles
          if (config.exemptRoles.length > 0) {
            const rolesList = config.exemptRoles
              .map((id) => `<@&${id}>`)
              .join(', ');
            embed.addFields({
              name: 'Exempt Roles',
              value: rolesList,
              inline: false,
            });
          } else {
            embed.addFields({
              name: 'Exempt Roles',
              value: '*None*',
              inline: false,
            });
          }

          // Channels
          if (config.exemptChannels.length > 0) {
            const channelsList = config.exemptChannels
              .map((id) => `<#${id}>`)
              .join(', ');
            embed.addFields({
              name: 'Exempt Channels',
              value: channelsList,
              inline: false,
            });
          } else {
            embed.addFields({
              name: 'Exempt Channels',
              value: '*None*',
              inline: false,
            });
          }

          // Users
          if (config.exemptUsers.length > 0) {
            const usersList = config.exemptUsers
              .map((id) => `<@${id}>`)
              .join(', ');
            embed.addFields({
              name: 'Exempt Users',
              value: usersList,
              inline: false,
            });
          } else {
            embed.addFields({
              name: 'Exempt Users',
              value: '*None*',
              inline: false,
            });
          }

          responseEmbed = embed;
          break;
        }

        default:
          responseEmbed = errorEmbed('Invalid Subcommand', 'An error occurred.');
      }

      if (updated) {
        await moduleConfig.setConfig(guildId, 'automod', config);
      }

      await interaction.editReply({ embeds: [responseEmbed] });
    } catch (error) {
      console.error('Error in automod-exempt command:', error);
      const embed = errorEmbed(
        'Command Error',
        'An error occurred while processing your request.'
      );
      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
