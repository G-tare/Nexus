import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  inlineCode,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('logignore')
    .setDescription('Exclude channels, roles, or users from logging')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add-channel')
        .setDescription('Ignore a channel from logging')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to ignore')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove-channel')
        .setDescription('Stop ignoring a channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to un-ignore')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add-role')
        .setDescription('Ignore a role from logging')
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Role to ignore')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove-role')
        .setDescription('Stop ignoring a role')
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Role to un-ignore')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add-user')
        .setDescription('Ignore a user from logging')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to ignore')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove-user')
        .setDescription('Stop ignoring a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to un-ignore')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('View all ignored channels, roles, and users'),
    ),

  module: 'logging',
  permissionPath: 'logging.staff.logignore',
  premiumFeature: 'logging.basic',
  ephemeral: true,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'logging');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;

    // Initialize arrays if they don't exist
    if (!config.ignoredChannels) config.ignoredChannels = [];
    if (!config.ignoredRoles) config.ignoredRoles = [];
    if (!config.ignoredUsers) config.ignoredUsers = [];

    if (subcommand === 'add-channel') {
      const channel = interaction.options.getChannel('channel', true);

      if (config.ignoredChannels.includes(channel.id)) {
        const embed = new EmbedBuilder()
          .setTitle('⚠ Already Ignored')
          .setDescription(`${channel} is already ignored`)
          .setColor('Yellow');

        return interaction.editReply({ embeds: [embed] });
      }

      config.ignoredChannels.push(channel.id);
      await moduleConfig.setConfig(guildId, 'logging', config);

      const embed = new EmbedBuilder()
        .setTitle('✓ Channel Ignored')
        .setDescription(`${channel} is now ignored from logging`)
        .setColor('Green');

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'remove-channel') {
      const channel = interaction.options.getChannel('channel', true);

      if (!config.ignoredChannels.includes(channel.id)) {
        const embed = new EmbedBuilder()
          .setTitle('⚠ Not Ignored')
          .setDescription(`${channel} was not ignored`)
          .setColor('Yellow');

        return interaction.editReply({ embeds: [embed] });
      }

      config.ignoredChannels = config.ignoredChannels.filter((id: any) => id !== channel.id);
      await moduleConfig.setConfig(guildId, 'logging', config);

      const embed = new EmbedBuilder()
        .setTitle('✓ Channel Un-Ignored')
        .setDescription(`${channel} is no longer ignored from logging`)
        .setColor('Green');

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'add-role') {
      const role = interaction.options.getRole('role', true);

      if (config.ignoredRoles.includes(role.id)) {
        const embed = new EmbedBuilder()
          .setTitle('⚠ Already Ignored')
          .setDescription(`${role} is already ignored`)
          .setColor('Yellow');

        return interaction.editReply({ embeds: [embed] });
      }

      config.ignoredRoles.push(role.id);
      await moduleConfig.setConfig(guildId, 'logging', config);

      const embed = new EmbedBuilder()
        .setTitle('✓ Role Ignored')
        .setDescription(`${role} is now ignored from logging`)
        .setColor('Green');

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'remove-role') {
      const role = interaction.options.getRole('role', true);

      if (!config.ignoredRoles.includes(role.id)) {
        const embed = new EmbedBuilder()
          .setTitle('⚠ Not Ignored')
          .setDescription(`${role} was not ignored`)
          .setColor('Yellow');

        return interaction.editReply({ embeds: [embed] });
      }

      config.ignoredRoles = config.ignoredRoles.filter((id: any) => id !== role.id);
      await moduleConfig.setConfig(guildId, 'logging', config);

      const embed = new EmbedBuilder()
        .setTitle('✓ Role Un-Ignored')
        .setDescription(`${role} is no longer ignored from logging`)
        .setColor('Green');

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'add-user') {
      const user = interaction.options.getUser('user', true);

      if (config.ignoredUsers.includes(user.id)) {
        const embed = new EmbedBuilder()
          .setTitle('⚠ Already Ignored')
          .setDescription(`${user} is already ignored`)
          .setColor('Yellow');

        return interaction.editReply({ embeds: [embed] });
      }

      config.ignoredUsers.push(user.id);
      await moduleConfig.setConfig(guildId, 'logging', config);

      const embed = new EmbedBuilder()
        .setTitle('✓ User Ignored')
        .setDescription(`${user} is now ignored from logging`)
        .setColor('Green');

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'remove-user') {
      const user = interaction.options.getUser('user', true);

      if (!config.ignoredUsers.includes(user.id)) {
        const embed = new EmbedBuilder()
          .setTitle('⚠ Not Ignored')
          .setDescription(`${user} was not ignored`)
          .setColor('Yellow');

        return interaction.editReply({ embeds: [embed] });
      }

      config.ignoredUsers = config.ignoredUsers.filter((id: any) => id !== user.id);
      await moduleConfig.setConfig(guildId, 'logging', config);

      const embed = new EmbedBuilder()
        .setTitle('✓ User Un-Ignored')
        .setDescription(`${user} is no longer ignored from logging`)
        .setColor('Green');

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'list') {
      const ignoredChannelsList =
        config.ignoredChannels.length > 0
          ? config.ignoredChannels.map((id: any) => `<#${id}>`).join(', ')
          : 'None';

      const ignoredRolesList =
        config.ignoredRoles.length > 0
          ? config.ignoredRoles.map((id: any) => `<@&${id}>`).join(', ')
          : 'None';

      const ignoredUsersList =
        config.ignoredUsers.length > 0
          ? config.ignoredUsers.map((id: any) => `<@${id}>`).join(', ')
          : 'None';

      const embed = new EmbedBuilder()
        .setTitle('🚫 Ignored from Logging')
        .addFields(
          { name: 'Channels', value: ignoredChannelsList, inline: false },
          { name: 'Roles', value: ignoredRolesList, inline: false },
          { name: 'Users', value: ignoredUsersList, inline: false },
        )
        .setColor('Blurple');

      return interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
