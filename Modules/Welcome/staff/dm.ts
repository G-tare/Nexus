import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getWelcomeConfig, WelcomeConfig } from '../helpers';
import { successReply, errorReply } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  module: 'welcome',
  permissionPath: 'welcome.staff.dm',
  premiumFeature: 'welcome.basic',
  defaultPermissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('welcomedm')
    .setDescription('Configure welcome DM messages for new members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable welcome DMs')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Whether welcome DMs are enabled')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('message')
        .setDescription('Set the welcome DM message text')
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('The DM message (max 2000 chars)')
            .setMaxLength(2000)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('embed')
        .setDescription('Toggle embed mode for welcome DMs')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Whether to use embeds for DMs')
            .setRequired(true)
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const subcommand = interaction.options.getSubcommand();
      const config = await getWelcomeConfig(guildId);

      switch (subcommand) {
        case 'toggle': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.dm.enabled = enabled;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          return interaction.editReply(
            successReply(
              'Welcome DMs',
              `Welcome DMs are now **${enabled ? 'enabled' : 'disabled'}**.\n\n${enabled ? '⚠️ Note: Members must have DMs enabled to receive these.' : ''}`
            )
          );
        }

        case 'message': {
          const message = interaction.options.getString('message', true);
          config.dm.message = message;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const placeholders = '{user}, {username}, {server}, {membercount}, {usertag}, {createdate}, {joindate}, {id}';
          return interaction.editReply(
            successReply(
              'Welcome DM Message Updated',
              `Available placeholders:\n\`${placeholders}\``
            )
          );
        }

        case 'embed': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.dm.useEmbed = enabled;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          return interaction.editReply(
            successReply(
              'Welcome DM Embed Mode',
              `Embed mode is now **${enabled ? 'enabled' : 'disabled'}**.`
            )
          );
        }

        default: {
          return interaction.editReply(
            errorReply('Unknown Subcommand', 'An unknown subcommand was provided.')
          );
        }
      }
    } catch (error) {
      console.error('[WelcomeDM Command Error]', error);
      return interaction.editReply(
        errorReply(
          'Error',
          'An error occurred while processing your command.'
        )
      );
    }
  },
};

export default command;
