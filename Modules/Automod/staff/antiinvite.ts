import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAutomodConfig, AutomodConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { Colors, successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';

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
    await interaction.deferReply({ ephemeral: true });

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
          const embed = errorEmbed('Invalid server ID format');
          await interaction.editReply({ embeds: [embed] });
          return;
        }

        const allowedServers = [...new Set([...(config.antiinvite.allowedServers || []), serverId])];
        updatedConfig.antiinvite = { ...config.antiinvite, allowedServers };
        message = `Server **${serverId}** added to allowlist\n\n**Allowed servers:**\n${allowedServers.slice(0, 10).join('\n')}${allowedServers.length > 10 ? '\n...' : ''}`;
      } else if (subcommand === 'remove-server') {
        const serverId = interaction.options.getString('server-id', true);

        if (!isValidSnowflake(serverId)) {
          const embed = errorEmbed('Invalid server ID format');
          await interaction.editReply({ embeds: [embed] });
          return;
        }

        const allowedServers = (config.antiinvite.allowedServers || []).filter(id => id !== serverId);

        if (allowedServers.length === (config.antiinvite.allowedServers || []).length) {
          const embed = errorEmbed(`Server **${serverId}** not found in allowlist`);
          await interaction.editReply({ embeds: [embed] });
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

        const embed = new EmbedBuilder()
          .setColor(Colors.Primary)
          .setTitle('Anti-Invite Configuration')
          .setDescription(
            `**Enabled:** ${config.antiinvite.enabled ? '✓' : '✗'}\n\n` +
            `**Allowed Servers (${allowedServers.length}):**\n` +
            (allowedServers.length > 0
              ? '```\n' + allowedServers.slice(0, 10).join('\n') + (allowedServers.length > 10 ? '\n... and ' + (allowedServers.length - 10) + ' more' : '') + '\n```'
              : '(none)\n') +
            `\n**Exempt Roles (${allowedRoles.length}):**\n` +
            (allowedRoles.length > 0
              ? allowedRoles.slice(0, 10).map((id: any) => `<@&${id}>`).join(', ') + (allowedRoles.length > 10 ? ` + ${allowedRoles.length - 10} more` : '')
              : '(none)')
          )
          .setFooter({ text: `Guild ID: ${guildId}` });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      await moduleConfig.setConfig(guildId, 'automod', updatedConfig);

      const embed = successEmbed(`Invite Filter Updated\n${message}`);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const embed = errorEmbed('Failed to update invite filter settings');
      await interaction.editReply({ embeds: [embed] });
      console.error('[Automod] Antiinvite command error:', error);
    }
  }
} as BotCommand;
