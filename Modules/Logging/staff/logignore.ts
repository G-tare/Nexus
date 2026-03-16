import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  inlineCode,
  ContainerBuilder,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { successContainer, warningContainer, infoContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

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
  async execute(interaction) {
    await interaction.deferReply();

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
        const container = warningContainer('Already Ignored');
        addText(container, `${channel} is already ignored`);
        return interaction.editReply(v2Payload([container]));
      }

      config.ignoredChannels.push(channel.id);
      await moduleConfig.setConfig(guildId, 'logging', config);

      const container = successContainer('Channel Ignored');
      addText(container, `${channel} is now ignored from logging`);
      return interaction.editReply(v2Payload([container]));
    }

    if (subcommand === 'remove-channel') {
      const channel = interaction.options.getChannel('channel', true);

      if (!config.ignoredChannels.includes(channel.id)) {
        const container = warningContainer('Not Ignored');
        addText(container, `${channel} was not ignored`);
        return interaction.editReply(v2Payload([container]));
      }

      config.ignoredChannels = config.ignoredChannels.filter((id: any) => id !== channel.id);
      await moduleConfig.setConfig(guildId, 'logging', config);

      const container = successContainer('Channel Un-Ignored');
      addText(container, `${channel} is no longer ignored from logging`);
      return interaction.editReply(v2Payload([container]));
    }

    if (subcommand === 'add-role') {
      const role = interaction.options.getRole('role', true);

      if (config.ignoredRoles.includes(role.id)) {
        const container = warningContainer('Already Ignored');
        addText(container, `${role} is already ignored`);
        return interaction.editReply(v2Payload([container]));
      }

      config.ignoredRoles.push(role.id);
      await moduleConfig.setConfig(guildId, 'logging', config);

      const container = successContainer('Role Ignored');
      addText(container, `${role} is now ignored from logging`);
      return interaction.editReply(v2Payload([container]));
    }

    if (subcommand === 'remove-role') {
      const role = interaction.options.getRole('role', true);

      if (!config.ignoredRoles.includes(role.id)) {
        const container = warningContainer('Not Ignored');
        addText(container, `${role} was not ignored`);
        return interaction.editReply(v2Payload([container]));
      }

      config.ignoredRoles = config.ignoredRoles.filter((id: any) => id !== role.id);
      await moduleConfig.setConfig(guildId, 'logging', config);

      const container = successContainer('Role Un-Ignored');
      addText(container, `${role} is no longer ignored from logging`);
      return interaction.editReply(v2Payload([container]));
    }

    if (subcommand === 'add-user') {
      const user = interaction.options.getUser('user', true);

      if (config.ignoredUsers.includes(user.id)) {
        const container = warningContainer('Already Ignored');
        addText(container, `${user} is already ignored`);
        return interaction.editReply(v2Payload([container]));
      }

      config.ignoredUsers.push(user.id);
      await moduleConfig.setConfig(guildId, 'logging', config);

      const container = successContainer('User Ignored');
      addText(container, `${user} is now ignored from logging`);
      return interaction.editReply(v2Payload([container]));
    }

    if (subcommand === 'remove-user') {
      const user = interaction.options.getUser('user', true);

      if (!config.ignoredUsers.includes(user.id)) {
        const container = warningContainer('Not Ignored');
        addText(container, `${user} was not ignored`);
        return interaction.editReply(v2Payload([container]));
      }

      config.ignoredUsers = config.ignoredUsers.filter((id: any) => id !== user.id);
      await moduleConfig.setConfig(guildId, 'logging', config);

      const container = successContainer('User Un-Ignored');
      addText(container, `${user} is no longer ignored from logging`);
      return interaction.editReply(v2Payload([container]));
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

      const container = infoContainer('Ignored from Logging');
      addFields(container, [
        { name: 'Channels', value: ignoredChannelsList, inline: false },
        { name: 'Roles', value: ignoredRolesList, inline: false },
        { name: 'Users', value: ignoredUsersList, inline: false },
      ]);

      return interaction.editReply(v2Payload([container]));
    }
  },
};

export default command;
