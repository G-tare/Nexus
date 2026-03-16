import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAutomodConfig, AutomodConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { successReply, errorReply } from '../../../Shared/src/utils/componentsV2';

const DOMAIN_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

function isValidDomain(domain: string): boolean {
  return DOMAIN_REGEX.test(domain.toLowerCase());
}

export default {
  module: 'automod',
  permissionPath: 'automod.staff.antilink',
  premiumFeature: 'automod.basic',
  permissions: [PermissionFlagsBits.ManageGuild],

  data: new SlashCommandBuilder()
    .setName('antilink')
    .setDescription('Configure link filtering settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable link filtering')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('Enable or disable link filtering')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('whitelist-add')
        .setDescription('Add a domain to the whitelist')
        .addStringOption(opt =>
          opt
            .setName('domain')
            .setDescription('Domain to whitelist (e.g., discord.com)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('whitelist-remove')
        .setDescription('Remove a domain from the whitelist')
        .addStringOption(opt =>
          opt
            .setName('domain')
            .setDescription('Domain to remove from whitelist')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('blacklist-add')
        .setDescription('Add a domain to the blacklist')
        .addStringOption(opt =>
          opt
            .setName('domain')
            .setDescription('Domain to blacklist')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('blacklist-remove')
        .setDescription('Remove a domain from the blacklist')
        .addStringOption(opt =>
          opt
            .setName('domain')
            .setDescription('Domain to remove from blacklist')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('exempt-channel')
        .setDescription('Toggle link filtering exemption for a channel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to toggle exemption')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('exempt-role')
        .setDescription('Toggle link filtering exemption for a role')
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('Role to toggle exemption')
            .setRequired(true)
        )
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
        updatedConfig.antilink = { ...config.antilink, enabled };
        message = `Link filtering ${enabled ? '**enabled**' : '**disabled**'}`;
      } else if (subcommand === 'whitelist-add') {
        const domain = interaction.options.getString('domain', true).toLowerCase();

        if (!isValidDomain(domain)) {
          await interaction.editReply(errorReply('Invalid Domain', 'Invalid domain format. Use format like: `discord.com`'));
          return;
        }

        const whitelistedDomains = [...new Set([...(config.antilink.whitelistedDomains || []), domain])];
        updatedConfig.antilink = { ...config.antilink, whitelistedDomains };
        message = `Domain **${domain}** added to whitelist\n\n**Current whitelist:**\n${whitelistedDomains.slice(0, 10).join(', ')}${whitelistedDomains.length > 10 ? '...' : ''}`;
      } else if (subcommand === 'whitelist-remove') {
        const domain = interaction.options.getString('domain', true).toLowerCase();
        const whitelistedDomains = (config.antilink.whitelistedDomains || []).filter((d: any) => d !== domain);

        if (whitelistedDomains.length === (config.antilink.whitelistedDomains || []).length) {
          await interaction.editReply(errorReply('Domain Not Found', `Domain **${domain}** not found in whitelist`));
          return;
        }

        updatedConfig.antilink = { ...config.antilink, whitelistedDomains };
        message = `Domain **${domain}** removed from whitelist\n\n**Current whitelist:**\n${whitelistedDomains.length > 0 ? whitelistedDomains.slice(0, 10).join(', ') + (whitelistedDomains.length > 10 ? '...' : '') : '(empty)'}`;
      } else if (subcommand === 'blacklist-add') {
        const domain = interaction.options.getString('domain', true).toLowerCase();

        if (!isValidDomain(domain)) {
          await interaction.editReply(errorReply('Invalid Domain', 'Invalid domain format. Use format like: `example.com`'));
          return;
        }

        const blacklistedDomains = [...new Set([...(config.antilink.blacklistedDomains || []), domain])];
        updatedConfig.antilink = { ...config.antilink, blacklistedDomains };
        message = `Domain **${domain}** added to blacklist\n\n**Current blacklist:**\n${blacklistedDomains.slice(0, 10).join(', ')}${blacklistedDomains.length > 10 ? '...' : ''}`;
      } else if (subcommand === 'blacklist-remove') {
        const domain = interaction.options.getString('domain', true).toLowerCase();
        const blacklistedDomains = (config.antilink.blacklistedDomains || []).filter((d: any) => d !== domain);

        if (blacklistedDomains.length === (config.antilink.blacklistedDomains || []).length) {
          await interaction.editReply(errorReply('Domain Not Found', `Domain **${domain}** not found in blacklist`));
          return;
        }

        updatedConfig.antilink = { ...config.antilink, blacklistedDomains };
        message = `Domain **${domain}** removed from blacklist\n\n**Current blacklist:**\n${blacklistedDomains.length > 0 ? blacklistedDomains.slice(0, 10).join(', ') + (blacklistedDomains.length > 10 ? '...' : '') : '(empty)'}`;
      } else if (subcommand === 'exempt-channel') {
        const channel = interaction.options.getChannel('channel', true);
        const allowedChannels = config.antilink.allowedChannels || [];
        const isExempt = allowedChannels.includes(channel.id);

        if (isExempt) {
          updatedConfig.antilink = {
            ...config.antilink,
            allowedChannels: allowedChannels.filter((id: any) => id !== channel.id)
          };
          message = `Channel <#${channel.id}> **removed** from exemptions`;
        } else {
          updatedConfig.antilink = {
            ...config.antilink,
            allowedChannels: [...allowedChannels, channel.id]
          };
          message = `Channel <#${channel.id}> **added** to exemptions`;
        }
      } else if (subcommand === 'exempt-role') {
        const role = interaction.options.getRole('role', true);
        const allowedRoles = config.antilink.allowedRoles || [];
        const isExempt = allowedRoles.includes(role.id);

        if (isExempt) {
          updatedConfig.antilink = {
            ...config.antilink,
            allowedRoles: allowedRoles.filter((id: any) => id !== role.id)
          };
          message = `Role <@&${role.id}> **removed** from exemptions`;
        } else {
          updatedConfig.antilink = {
            ...config.antilink,
            allowedRoles: [...allowedRoles, role.id]
          };
          message = `Role <@&${role.id}> **added** to exemptions`;
        }
      }

      await moduleConfig.setConfig(guildId, 'automod', updatedConfig);

      await interaction.editReply(successReply('Link Filter Updated', message));
    } catch (error) {
      await interaction.editReply(errorReply('Configuration Error', 'Failed to update link filter settings'));
      console.error('[Automod] Antilink command error:', error);
    }
  }
} as BotCommand;
