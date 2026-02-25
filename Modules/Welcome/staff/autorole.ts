import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Role, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getWelcomeConfig, WelcomeConfig } from '../helpers';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  module: 'welcome',
  permissionPath: 'welcome.staff.autorole',
  premiumFeature: 'welcome.basic',
  defaultPermissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Manage automatic roles assigned to new members')
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable autoroles')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Whether autoroles are enabled')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a role to be assigned to new members')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to assign')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a role from autoroles')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add-bot')
        .setDescription('Add a role to be assigned to new bots')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to assign to bots')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove-bot')
        .setDescription('Remove a bot-specific role from autoroles')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delay')
        .setDescription('Set delay before assigning autoroles')
        .addIntegerOption(option =>
          option
            .setName('seconds')
            .setDescription('Delay in seconds (0-600)')
            .setMinValue(0)
            .setMaxValue(600)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all configured autoroles')
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const subcommand = interaction.options.getSubcommand();
      const config = await getWelcomeConfig(guildId);
      const guild = interaction.guild!;

      switch (subcommand) {
        case 'toggle': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.autorole.enabled = enabled;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Autoroles',
            `Autoroles are now **${enabled ? 'enabled' : 'disabled'}**.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'add': {
          const role = interaction.options.getRole('role', true) as Role;

          // Check bot role hierarchy
          const botHighestRole = guild.members.me?.roles.highest;
          if (!botHighestRole || role.position >= botHighestRole.position) {
            const embed = errorEmbed(
              'Role Too High',
              `I cannot assign ${role} because my highest role is ${botHighestRole}. Please move my role higher in the role hierarchy.`
            ).setColor(Colors.Error);
            return interaction.editReply({ embeds: [embed] });
          }

          // Check max roles (10)
          if (config.autorole.roles.length >= 10) {
            const embed = errorEmbed(
              'Too Many Roles',
              'You can only have a maximum of 10 autoroles. Remove one first.'
            ).setColor(Colors.Error);
            return interaction.editReply({ embeds: [embed] });
          }

          // Check if already added
          if (config.autorole.roles.includes(role.id)) {
            const embed = errorEmbed(
              'Role Already Added',
              `${role} is already in the autoroles list.`
            ).setColor(Colors.Error);
            return interaction.editReply({ embeds: [embed] });
          }

          config.autorole.roles.push(role.id);
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Autorole Added',
            `${role} will now be assigned to new members.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'remove': {
          const role = interaction.options.getRole('role', true) as Role;

          if (!config.autorole.roles.includes(role.id)) {
            const embed = errorEmbed(
              'Role Not Found',
              `${role} is not in the autoroles list.`
            ).setColor(Colors.Error);
            return interaction.editReply({ embeds: [embed] });
          }

          config.autorole.roles = config.autorole.roles.filter(id => id !== role.id);
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Autorole Removed',
            `${role} will no longer be assigned to new members.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'add-bot': {
          const role = interaction.options.getRole('role', true) as Role;

          // Check bot role hierarchy
          const botHighestRole = guild.members.me?.roles.highest;
          if (!botHighestRole || role.position >= botHighestRole.position) {
            const embed = errorEmbed(
              'Role Too High',
              `I cannot assign ${role} because my highest role is ${botHighestRole}. Please move my role higher in the role hierarchy.`
            ).setColor(Colors.Error);
            return interaction.editReply({ embeds: [embed] });
          }

          // Check max roles (10)
          if (config.autorole.botRoles.length >= 10) {
            const embed = errorEmbed(
              'Too Many Roles',
              'You can only have a maximum of 10 bot autoroles. Remove one first.'
            ).setColor(Colors.Error);
            return interaction.editReply({ embeds: [embed] });
          }

          // Check if already added
          if (config.autorole.botRoles.includes(role.id)) {
            const embed = errorEmbed(
              'Role Already Added',
              `${role} is already in the bot autoroles list.`
            ).setColor(Colors.Error);
            return interaction.editReply({ embeds: [embed] });
          }

          config.autorole.botRoles.push(role.id);
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Bot Autorole Added',
            `${role} will now be assigned to new bot members.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'remove-bot': {
          const role = interaction.options.getRole('role', true) as Role;

          if (!config.autorole.botRoles.includes(role.id)) {
            const embed = errorEmbed(
              'Role Not Found',
              `${role} is not in the bot autoroles list.`
            ).setColor(Colors.Error);
            return interaction.editReply({ embeds: [embed] });
          }

          config.autorole.botRoles = config.autorole.botRoles.filter(id => id !== role.id);
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Bot Autorole Removed',
            `${role} will no longer be assigned to new bots.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'delay': {
          const seconds = interaction.options.getInteger('seconds', true);
          config.autorole.delaySeconds = seconds;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Autorole Delay Updated',
            `Roles will be assigned with a **${seconds}s delay**.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'list': {
          let description = '';

          // Regular roles
          if (config.autorole.roles.length > 0) {
            description += '**Regular Member Autoroles:**\n';
            for (const roleId of config.autorole.roles) {
              try {
                const role = await guild.roles.fetch(roleId);
                if (role) {
                  description += `• ${role} (${roleId})\n`;
                } else {
                  description += `• \`${roleId}\` (deleted role)\n`;
                }
              } catch {
                description += `• \`${roleId}\` (error fetching)\n`;
              }
            }
          } else {
            description += '**Regular Member Autoroles:** None configured\n';
          }

          description += '\n';

          // Bot roles
          if (config.autorole.botRoles.length > 0) {
            description += '**Bot Autoroles:**\n';
            for (const roleId of config.autorole.botRoles) {
              try {
                const role = await guild.roles.fetch(roleId);
                if (role) {
                  description += `• ${role} (${roleId})\n`;
                } else {
                  description += `• \`${roleId}\` (deleted role)\n`;
                }
              } catch {
                description += `• \`${roleId}\` (error fetching)\n`;
              }
            }
          } else {
            description += '**Bot Autoroles:** None configured\n';
          }

          description += `\n**Status:** ${config.autorole.enabled ? '✅ Enabled' : '❌ Disabled'}\n`;
          description += `**Delay:** ${config.autorole.delaySeconds}s`;

          const embed = successEmbed(
            'Autoroles Configuration',
            description
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        default: {
          const embed = errorEmbed('Unknown Subcommand', 'An unknown subcommand was provided.').setColor(Colors.Error);
          return interaction.editReply({ embeds: [embed] });
        }
      }
    } catch (error) {
      console.error('[Autorole Command Error]', error);
      const embed = errorEmbed(
        'Error',
        'An error occurred while processing your command.'
      ).setColor(Colors.Error);
      return interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
