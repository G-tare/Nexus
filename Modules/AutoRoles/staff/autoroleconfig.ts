import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getAutoRolesConfig } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autoroleconfig')
    .setDescription('View or update auto-role settings')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current auto-role settings'))
    .addSubcommand(sub =>
      sub.setName('persistent')
        .setDescription('Toggle persistent roles (restore on rejoin)')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable persistent roles')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('ignorebots')
        .setDescription('Toggle ignoring bots for auto-roles')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Ignore bots')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('logchannel')
        .setDescription('Set the log channel for auto-role assignments')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Log channel (leave empty to disable)')
            .addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub =>
      sub.setName('stackroles')
        .setDescription('Toggle stacking (assign all matching rules vs. first match only)')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Stack all matching roles')
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  module: 'autoroles',
  permissionPath: 'autoroles.autoroleconfig',
  premiumFeature: 'autoroles.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const config = await getAutoRolesConfig(guild.id);

      const container = moduleContainer('auto_roles');
      addText(container, '### 🏷️ Auto-Role Settings');
      addFields(container, [
        { name: 'Persistent Roles', value: config.persistentRoles ? '✅ Enabled' : '❌ Disabled', inline: true },
        { name: 'Ignore Bots', value: config.ignoreBots ? '✅ Yes' : '❌ No', inline: true },
        { name: 'Stack Roles', value: config.stackRoles ? '✅ All matching' : '❌ First match only', inline: true },
        { name: 'Log Channel', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not set', inline: true },
      ]);

      await interaction.reply(v2Payload([container]));
      return;
    }

    if (sub === 'persistent') {
      const enabled = interaction.options.getBoolean('enabled', true);
      await moduleConfig.updateConfig(guild.id, 'autoroles', { persistentRoles: enabled });
      await interaction.reply({ content: `✅ Persistent roles ${enabled ? 'enabled' : 'disabled'}.` });
      return;
    }

    if (sub === 'ignorebots') {
      const enabled = interaction.options.getBoolean('enabled', true);
      await moduleConfig.updateConfig(guild.id, 'autoroles', { ignoreBots: enabled });
      await interaction.reply({ content: `✅ ${enabled ? 'Now ignoring' : 'No longer ignoring'} bots for auto-roles.` });
      return;
    }

    if (sub === 'logchannel') {
      const channel = interaction.options.getChannel('channel');
      const channelId = channel?.id || null;
      await moduleConfig.updateConfig(guild.id, 'autoroles', { logChannelId: channelId });
      await interaction.reply({
        content: channelId
          ? `✅ Auto-role log channel set to <#${channelId}>.`
          : '✅ Auto-role logging disabled.',
      });
      return;
    }

    if (sub === 'stackroles') {
      const enabled = interaction.options.getBoolean('enabled', true);
      await moduleConfig.updateConfig(guild.id, 'autoroles', { stackRoles: enabled });
      await interaction.reply({
        content: `✅ Role stacking ${enabled ? 'enabled (all matching rules apply)' : 'disabled (first match only)'}.`,
      });
      return;
    }
  },
};

export default command;
