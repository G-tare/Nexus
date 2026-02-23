import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Welcome:Config');

const welcomeConfig: BotCommand = {
  module: 'welcome',
  permissionPath: 'welcome.staff.config',
  data: new SlashCommandBuilder()
    .setName('welcome-config')
    .setDescription('Manage all welcome module settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View all welcome settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Quick toggle for welcome features')
        .addStringOption((opt) =>
          opt
            .setName('feature')
            .setDescription('Feature to toggle')
            .addChoices(
              { name: 'Welcome Messages', value: 'welcome' },
              { name: 'Leave Messages', value: 'leave' },
              { name: 'Welcome DMs', value: 'dm' },
              { name: 'Autoroles', value: 'autorole' },
              { name: 'Member Greetings', value: 'greet' },
              { name: 'Member Screening', value: 'screening' },
              { name: 'Join Gate', value: 'joingate' }
            )
            .setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable or disable the feature')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();

    try {
      const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'welcome');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
      const guild = interaction.guild!;

      if (subcommand === 'view') {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Welcome Module Configuration')
          .setDescription(`Settings for **${guild.name}**`)
          .addFields(
            {
              name: '📨 Welcome Messages',
              value: `**Status:** ${config.welcome.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Channel:** ${
                config.welcome.channelId
                  ? `<#${config.welcome.channelId}>`
                  : 'Not set'
              }\n**Mode:** ${config.welcome.embedMode ? 'Embed' : 'Text'}\n**Image Mode:** ${config.welcome.imageMode}`,
              inline: true,
            },
            {
              name: '👋 Leave Messages',
              value: `**Status:** ${config.leave.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Channel:** ${
                config.leave.channelId ? `<#${config.leave.channelId}>` : 'Not set'
              }\n**Mode:** ${config.leave.embedMode ? 'Embed' : 'Text'}`,
              inline: true,
            },
            {
              name: '💌 Welcome DMs',
              value: `**Status:** ${config.dm.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Mode:** ${config.dm.embedMode ? 'Embed' : 'Text'}`,
              inline: true,
            },
            {
              name: '🎯 Autoroles',
              value: `**Status:** ${config.autorole.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Roles:** ${config.autorole.roleIds.length}\n**Delay:** ${config.autorole.delayMs}ms`,
              inline: true,
            },
            {
              name: '👋 Member Greetings',
              value: `**Status:** ${config.greet.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Channel:** ${
                config.greet.channelId
                  ? `<#${config.greet.channelId}>`
                  : 'First message channel'
              }`,
              inline: true,
            },
            {
              name: '🔒 Member Screening',
              value: `**Status:** ${config.screening.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Role:** ${
                config.screening.verifiedRoleId
                  ? `<@&${config.screening.verifiedRoleId}>`
                  : 'Not set'
              }`,
              inline: true,
            },
            {
              name: '⚔️ Join Gate',
              value: `**Status:** ${config.joingate.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Min Age:** ${config.joingate.minimumAccountAgeDays} days\n**Action:** ${config.joingate.actionForYoungAccounts}`,
              inline: true,
            }
          )
          .setFooter({ text: 'Use /greet, /screening, /joingate to configure individual features' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'toggle') {
        const feature = interaction.options.getString('feature', true);
        const enabled = interaction.options.getBoolean('enabled', true);

        const featureMap: Record<string, string> = {
          welcome: 'welcome',
          leave: 'leave',
          dm: 'dm',
          autorole: 'autorole',
          greet: 'greet',
          screening: 'screening',
          joingate: 'joingate',
        };

        const configKey = featureMap[feature];

        const updatedConfig = { ...config };
        if (configKey in updatedConfig) {
          (updatedConfig as any)[configKey] = {
            ...(updatedConfig as any)[configKey],
            enabled,
          };
        }

        await moduleConfig.setConfig(guildId, 'welcome', updatedConfig);

        const featureNames: Record<string, string> = {
          welcome: 'Welcome Messages',
          leave: 'Leave Messages',
          dm: 'Welcome DMs',
          autorole: 'Autoroles',
          greet: 'Member Greetings',
          screening: 'Member Screening',
          joingate: 'Join Gate',
        };

        return interaction.editReply(
          `✅ **${featureNames[feature]}** has been **${enabled ? 'enabled' : 'disabled'}**.`
        );
      }
    } catch (error) {
      logger.error('Error in welcome-config command:', error);
      return interaction.editReply(
        '❌ An error occurred while managing welcome settings.'
      );
    }
  },
};

export default welcomeConfig;
