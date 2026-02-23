import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  Role,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { getAntiRaidConfig, saveAntiRaidConfig } from '../helpers';

const logger = createModuleLogger('AntiRaid');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('antiraidconfig')
    .setDescription('Configure AntiRaid settings for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => sub.setName('view').setDescription('View current AntiRaid configuration'))
    .addSubcommand((sub) => sub.setName('enable').setDescription('Enable AntiRaid protection'))
    .addSubcommand((sub) => sub.setName('disable').setDescription('Disable AntiRaid protection'))
    .addSubcommand((sub) =>
      sub.setName('jointhreshold').setDescription('Set the join velocity threshold')
        .addIntegerOption((opt) => opt.setName('threshold').setDescription('Number of joins before raid is triggered').setMinValue(1).setMaxValue(100).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('joinwindow').setDescription('Set the join window duration')
        .addIntegerOption((opt) => opt.setName('seconds').setDescription('Time window in seconds').setMinValue(10).setMaxValue(600).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('accountage').setDescription('Set minimum account age requirement')
        .addIntegerOption((opt) => opt.setName('hours').setDescription('Minimum account age in hours').setMinValue(0).setMaxValue(720).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('action').setDescription('Set the action to take when raid is detected')
        .addStringOption((opt) =>
          opt.setName('action').setDescription('Action to take').setRequired(true)
            .addChoices({ name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }, { name: 'Quarantine', value: 'quarantine' }, { name: 'Alert Only', value: 'alert' })
        )
    )
    .addSubcommand((sub) =>
      sub.setName('alertchannel').setDescription('Set the channel for raid alerts')
        .addChannelOption((opt) => opt.setName('channel').setDescription('Alert channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('quarantinerole').setDescription('Set the quarantine role')
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to assign to quarantined members').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('lockdownduration').setDescription('Set the auto-lockdown duration')
        .addIntegerOption((opt) => opt.setName('seconds').setDescription('Duration in seconds').setMinValue(60).setMaxValue(86400).setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('verification').setDescription('Enable or disable member verification')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable verification').setRequired(true))
    ),

  module: 'antiraid',
  permissionPath: 'antiraid.staff.antiraidconfig',
  premiumFeature: 'antiraid.management',
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
      }

      const guildId = interaction.guildId!;
      const subcommand = interaction.options.getSubcommand();
      const config = await getAntiRaidConfig(guildId);

      if (subcommand === 'view') {
        const embed = new EmbedBuilder()
          .setColor('#0099FF')
          .setTitle('AntiRaid Configuration')
          .setDescription(`Raid protection settings for ${interaction.guild.name}`)
          .addFields(
            { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Join Threshold', value: `${config.joinThreshold} joins`, inline: true },
            { name: 'Join Window', value: `${config.joinWindow}s`, inline: true },
            { name: 'Min Account Age', value: `${config.minAccountAge}h`, inline: true },
            { name: 'Auto-Lockdown', value: config.autoLockdown ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Lockdown Duration', value: `${config.lockdownDuration}s`, inline: true },
            { name: 'Action on Raid', value: config.action.toUpperCase(), inline: true },
            { name: 'Verification', value: config.verificationEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Alert Channel', value: config.alertChannelId ? `<#${config.alertChannelId}>` : 'Not set', inline: true },
            { name: 'Quarantine Role', value: config.quarantineRoleId ? `<@&${config.quarantineRoleId}>` : 'Not set', inline: true }
          )
          .setFooter({ text: 'AntiRaid System' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
      }

      // Handle all config updates
      if (subcommand === 'enable') {
        config.enabled = true;
      } else if (subcommand === 'disable') {
        config.enabled = false;
      } else if (subcommand === 'jointhreshold') {
        config.joinThreshold = interaction.options.getInteger('threshold', true);
      } else if (subcommand === 'joinwindow') {
        config.joinWindow = interaction.options.getInteger('seconds', true);
      } else if (subcommand === 'accountage') {
        config.minAccountAge = interaction.options.getInteger('hours', true);
      } else if (subcommand === 'action') {
        config.action = interaction.options.getString('action', true) as 'kick' | 'ban' | 'quarantine' | 'alert';
      } else if (subcommand === 'alertchannel') {
        config.alertChannelId = interaction.options.getChannel('channel', true).id;
      } else if (subcommand === 'quarantinerole') {
        config.quarantineRoleId = (interaction.options.getRole('role', true) as Role).id;
      } else if (subcommand === 'lockdownduration') {
        config.lockdownDuration = interaction.options.getInteger('seconds', true);
      } else if (subcommand === 'verification') {
        config.verificationEnabled = interaction.options.getBoolean('enabled', true);
      }

      await saveAntiRaidConfig(guildId, config);

      const labels: Record<string, string> = {
        enable: '✅ AntiRaid Enabled',
        disable: '❌ AntiRaid Disabled',
        jointhreshold: `✅ Join Threshold Updated to ${config.joinThreshold}`,
        joinwindow: `✅ Join Window Updated to ${config.joinWindow}s`,
        accountage: `✅ Min Account Age Updated to ${config.minAccountAge}h`,
        action: `✅ Raid Action Updated to ${config.action.toUpperCase()}`,
        alertchannel: `✅ Alert Channel Updated to <#${config.alertChannelId}>`,
        quarantinerole: `✅ Quarantine Role Updated to <@&${config.quarantineRoleId}>`,
        lockdownduration: `✅ Lockdown Duration Updated to ${config.lockdownDuration}s`,
        verification: `✅ Verification ${config.verificationEnabled ? 'Enabled' : 'Disabled'}`,
      };

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(subcommand === 'disable' ? '#FF0000' : '#0099FF')
            .setTitle(labels[subcommand] || '✅ Configuration Updated')
            .setFooter({ text: `Updated by ${interaction.user.username}` })
            .setTimestamp(),
        ],
      });
    } catch (error) {
      logger.error('Error in antiraidconfig command:', error);
      await interaction.reply({ content: '❌ An error occurred while updating the configuration.', ephemeral: true });
    }
  },
};

export default command;
