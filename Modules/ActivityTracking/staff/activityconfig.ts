import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getActivityConfig, updateActivityConfig, ActivityConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('ActivityTracking');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('activityconfig')
    .setDescription('Configure activity tracking settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand.setName('view').setDescription('View current activity tracking configuration')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('excludechannel')
        .setDescription('Add or remove a channel from exclusion list')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('The channel to exclude or include').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('excluderole')
        .setDescription('Add or remove a role from exclusion list')
        .addRoleOption((option) =>
          option.setName('role').setDescription('The role to exclude or include').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('threshold')
        .setDescription('Set the inactivity threshold in days')
        .addIntegerOption((option) =>
          option.setName('days').setDescription('Number of days before marking member as inactive').setRequired(true).setMinValue(1).setMaxValue(365)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('logchannel')
        .setDescription('Set the log channel for activity events')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('The channel to log activity events (leave empty to disable)').setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('Toggle tracking types')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('The tracking type to toggle')
            .setRequired(true)
            .addChoices(
              { name: 'Voice', value: 'trackVoice' },
              { name: 'Messages', value: 'trackMessages' },
              { name: 'Reactions', value: 'trackReactions' }
            )
        )
    ),

  module: 'activitytracking',
  permissionPath: 'activitytracking.staff.activityconfig',
  premiumFeature: 'activitytracking.management',
  cooldown: 3,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.' });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const config = await getActivityConfig(interaction.guild.id);

      if (subcommand === 'view') {
        const container = moduleContainer('activity_tracking');
        addText(container, '### Activity Tracking Configuration');
        addFields(container, [
          { name: '🎤 Track Voice', value: config.trackVoice ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: '💬 Track Messages', value: config.trackMessages ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: '👍 Track Reactions', value: config.trackReactions ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: '⏰ Inactivity Threshold', value: `\`${config.inactiveThresholdDays} days\``, inline: true },
          { name: '📝 Log Channel', value: config.logChannelId ? `<#${config.logChannelId}>` : '`Not set`', inline: true },
          { name: '🚫 Excluded Channels', value: config.excludedChannels.length > 0 ? config.excludedChannels.map((id) => `<#${id}>`).join(', ') : '`None`', inline: false },
          { name: '🚫 Excluded Roles', value: config.excludedRoles.length > 0 ? config.excludedRoles.map((id) => `<@&${id}>`).join(', ') : '`None`', inline: false }
        ]);

        await interaction.reply(v2Payload([container]));
      } else if (subcommand === 'excludechannel') {
        const channel = interaction.options.getChannel('channel', true);
        const isExcluded = config.excludedChannels.includes(channel.id);
        const updatedChannels = isExcluded
          ? config.excludedChannels.filter((id) => id !== channel.id)
          : [...config.excludedChannels, channel.id];

        await updateActivityConfig(interaction.guildId!, { excludedChannels: updatedChannels });
        await interaction.reply({ content: `✅ Channel <#${channel.id}> has been ${isExcluded ? 'removed from' : 'added to'} the exclusion list.` });
      } else if (subcommand === 'excluderole') {
        const role = interaction.options.getRole('role', true);
        const isExcluded = config.excludedRoles.includes(role.id);
        const updatedRoles = isExcluded
          ? config.excludedRoles.filter((id) => id !== role.id)
          : [...config.excludedRoles, role.id];

        await updateActivityConfig(interaction.guildId!, { excludedRoles: updatedRoles });
        await interaction.reply({ content: `✅ Role <@&${role.id}> has been ${isExcluded ? 'removed from' : 'added to'} the exclusion list.` });
      } else if (subcommand === 'threshold') {
        const days = interaction.options.getInteger('days', true);
        await updateActivityConfig(interaction.guildId!, { inactiveThresholdDays: days });
        await interaction.reply({ content: `✅ Inactivity threshold has been set to \`${days} days\`.` });
      } else if (subcommand === 'logchannel') {
        const channel = interaction.options.getChannel('channel');
        await updateActivityConfig(interaction.guildId!, { logChannelId: channel?.id || null });
        await interaction.reply({ content: channel ? `✅ Log channel has been set to <#${channel.id}>.` : '✅ Log channel has been disabled.' });
      } else if (subcommand === 'toggle') {
        const type = interaction.options.getString('type', true) as 'trackVoice' | 'trackMessages' | 'trackReactions';
        const newValue = !config[type];
        await updateActivityConfig(interaction.guildId!, { [type]: newValue });
        const label = type === 'trackVoice' ? 'Voice tracking' : type === 'trackMessages' ? 'Message tracking' : 'Reaction tracking';
        await interaction.reply({ content: `✅ ${label} is now ${newValue ? '**enabled**' : '**disabled**'}.` });
      }
    } catch (error) {
      logger.error('Error executing activityconfig command', error);
      await interaction.reply({ content: '❌ An error occurred while processing the configuration.' });
    }
  },
};

export default command;
