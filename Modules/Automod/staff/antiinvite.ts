import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAutomodConfig, AutomodConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { moduleContainer, addText, addFields, addSeparator, successReply, errorReply } from '../../../Shared/src/utils/componentsV2';

function isValidSnowflake(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

export default {
  module: 'automod',
  permissionPath: 'automod.staff.antiinvite',
  premiumFeature: 'automod.basic',
  permissions: [PermissionFlagsBits.ManageGuild],

  data: new SlashCommandBuilder()
    .setName('antiinvite')
    .setDescription('Configure Discord invite blocking')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable invite blocking')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('Enable or disable invite blocking')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('allow-server')
        .setDescription('Allow invites from a specific server')
        .addStringOption(opt =>
          opt
            .setName('server-id')
            .setDescription('Server ID to allow invites from')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove-server')
        .setDescription('Remove a server from the allowlist')
        .addStringOption(opt =>
          opt
            .setName('server-id')
            .setDescription('Server ID to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('exempt-role')
        .setDescription('Toggle invite exemption for a role')
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('Role to toggle exemption')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Show allowed servers and exempt roles')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      const config = await getAutomodConfig(guildId);
      const subcommand = interaction.options.getSubcommand();

      let updatedConfig: AutomodConfig = { ...config };
      let message = '';

      if (subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled', true);
        updatedConfig.antiinvite = { ...config.antiinvite, enabled };
        message = `Invite blocking ${enabled ? '**enabled**' : '**disabled**'}`;
      } else if (subcommand === 'allow-server') {
        const serverId = interaction.options.getString('server-id', true);

        if (!isValidSnowflake(serverId)) {
          await interaction.editReply(errorReply('Invalid Server ID', 'Invalid server ID format'));
          return;
        }

        const allowedServers = [...new Set([...(config.antiinvite.allowedServers || []), serverId])];
        updatedConfig.antiinvite = { ...config.antiinvite, allowedServers };
        message = `Server **${serverId}** added to allowlist\n\n**Allowed servers:**\n${allowedServers.slice(0, 10).join('\n')}${allowedServers.length > 10 ? '\n...' : ''}`;
      } else if (subcommand === 'remove-server') {
        const serverId = interaction.options.getString('server-id', true);

        if (!isValidSnowflake(serverId)) {
          await interaction.editReply(errorReply('Invalid Server ID', 'Invalid server ID format'));
          return;
        }

        const allowedServers = (config.antiinvite.allowedServers || []).filter(id => id !== serverId);

        if (allowedServers.length === (config.antiinvite.allowedServers || []).length) {
          await interaction.editReply(errorReply('Server Not Found', `Server **${serverId}** not found in allowlist`));
          return;
        }

        updatedConfig.antiinvite = { ...config.antiinvite, allowedServers };
        message = `Server **${serverId}** removed from allowlist\n\n**Allowed servers:**\n${allowedServers.length > 0 ? allowedServers.slice(0, 10).join('\n') + (allowedServers.length > 10 ? '\n...' : '') : '(empty)'}`;
      } else if (subcommand === 'exempt-role') {
        const role = interaction.options.getRole('role', true);
        const allowedRoles = config.antiinvite.allowedRoles || [];
        const isExempt = allowedRoles.includes(role.id);

        if (isExempt) {
          updatedConfig.antiinvite = {
            ...config.antiinvite,
            allowedRoles: allowedRoles.filter((id: any) => id !== role.id)
          };
          message = `Role <@&${role.id}> **removed** from invite exemptions`;
        } else {
          updatedConfig.antiinvite = {
            ...config.antiinvite,
            allowedRoles: [...allowedRoles, role.id]
          };
          message = `Role <@&${role.id}> **added** to invite exemptions`;
        }
      } else if (subcommand === 'list') {
        const allowedServers = config.antiinvite.allowedServers || [];
        const allowedRoles = config.antiinvite.allowedRoles || [];

        const container = moduleContainer('automod');
        addText(container, '### Anti-Invite Configuration');
        addSeparator(container, 'small');

        const serversList = allowedServers.length > 0
          ? allowedServers.slice(0, 10).join('\n') + (allowedServers.length > 10 ? `\n... and ${allowedServers.length - 10} more` : '')
          : '(none)';

        const rolesList = allowedRoles.length > 0
          ? allowedRoles.slice(0, 10).map((id: any) => `<@&${id}>`).join(', ') + (allowedRoles.length > 10 ? ` + ${allowedRoles.length - 10} more` : '')
          : '(none)';

        const fields: Array<{ name: string; value: string; inline?: boolean }> = [
          { name: 'Enabled', value: config.antiinvite.enabled ? '✓' : '✗', inline: true },
          { name: `Allowed Servers (${allowedServers.length})`, value: serversList },
          { name: `Exempt Roles (${allowedRoles.length})`, value: rolesList },
        ];

        addFields(container, fields);
        await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        return;
      }

      await moduleConfig.setConfig(guildId, 'automod', updatedConfig);

      await interaction.editReply(successReply('Invite Filter Updated', message));
    } catch (error) {
      await interaction.editReply(errorReply('Configuration Error', 'Failed to update invite filter settings'));
      console.error('[Automod] Antiinvite command error:', error);
    }
  }
} as BotCommand;
