import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addFields, v2Payload, successReply } from '../../../Shared/src/utils/componentsV2';
import { getMessageTrackingConfig, setMessageTrackingConfig } from '../helpers';

const logger = createModuleLogger('MessageTracking');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('messagetrackconfig')
    .setDescription('Configure message tracking settings for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand.setName('view').setDescription('View current message tracking configuration')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('logchannel')
        .setDescription('Set the log channel for message tracking events')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('The channel to log to').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('snipe')
        .setDescription('Toggle snipe/editsnipe functionality')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Enable or disable snipe features').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('ghostping')
        .setDescription('Toggle ghost ping detection and alerts')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Enable or disable ghost ping alerts').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('ignorechannel')
        .setDescription('Toggle message tracking for a specific channel')
        .addChannelOption((option) =>
          option.setName('channel').setDescription('The channel to toggle tracking for').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    ),

  module: 'messagetracking',
  permissionPath: 'messagetracking.staff.messagetrackconfig',
  premiumFeature: 'messagetracking.management',
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.' });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const config = await getMessageTrackingConfig(interaction.guild.id);

      if (subcommand === 'view') {
        const container = moduleContainer('message_tracking');
        addFields(container, [
          { name: 'Log Edits', value: config.logEdits ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Log Deletes', value: config.logDeletes ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Log Bulk Deletes', value: config.logBulkDeletes ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Ghost Ping Alert', value: config.ghostPingAlert ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Snipe Enabled', value: config.snipeEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Snipe Timeout', value: `${config.snipeTimeout} seconds`, inline: true },
          { name: 'Log Channel', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not configured', inline: false },
          { name: 'Ignore Bots', value: config.ignoreBots ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Ignored Channels', value: config.ignoredChannels.length > 0 ? config.ignoredChannels.map((id) => `<#${id}>`).join(', ') : 'None', inline: false }
        ]);

        await interaction.reply(v2Payload([container]));
      } else if (subcommand === 'logchannel') {
        const channel = interaction.options.getChannel('channel', true);
        await setMessageTrackingConfig(interaction.guild.id, { logChannelId: channel.id });

        await interaction.reply(successReply('Configuration Updated', `Log channel set to <#${channel.id}>`));
      } else if (subcommand === 'snipe') {
        const enabled = interaction.options.getBoolean('enabled', true);
        await setMessageTrackingConfig(interaction.guild.id, { snipeEnabled: enabled });

        await interaction.reply(successReply('Configuration Updated', `Snipe functionality ${enabled ? '✅ enabled' : '❌ disabled'}`));
      } else if (subcommand === 'ghostping') {
        const enabled = interaction.options.getBoolean('enabled', true);
        await setMessageTrackingConfig(interaction.guild.id, { ghostPingAlert: enabled });

        await interaction.reply(successReply('Configuration Updated', `Ghost ping alerts ${enabled ? '✅ enabled' : '❌ disabled'}`));
      } else if (subcommand === 'ignorechannel') {
        const channel = interaction.options.getChannel('channel', true);
        const ignoredChannels = [...config.ignoredChannels];
        const index = ignoredChannels.indexOf(channel.id);

        let isNowIgnored: boolean;
        if (index > -1) {
          ignoredChannels.splice(index, 1);
          isNowIgnored = false;
        } else {
          ignoredChannels.push(channel.id);
          isNowIgnored = true;
        }

        await setMessageTrackingConfig(interaction.guild.id, { ignoredChannels });

        await interaction.reply(successReply('Configuration Updated', `<#${channel.id}> is now ${isNowIgnored ? '❌ ignored' : '✅ tracked'} for message tracking`));
      }
    } catch (error) {
      logger.error('Error executing messagetrackconfig command:', error);
      await interaction.reply({ content: '❌ An error occurred while processing your request.' });
    }
  },
};

export default command;
