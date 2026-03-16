import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getWelcomeConfig, WelcomeConfig } from '../helpers';
import { successReply, errorReply } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  module: 'welcome',
  permissionPath: 'welcome.staff.leave',
  premiumFeature: 'welcome.basic',
  defaultPermissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Configure leave messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable leave messages')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Whether leave messages are enabled')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel')
        .setDescription('Set the channel for leave messages')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('The channel to send leave messages to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('message')
        .setDescription('Set the leave message text')
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('The leave message (max 2000 chars)')
            .setMaxLength(2000)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('embed')
        .setDescription('Toggle embed mode for leave messages')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Whether to use embeds')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('embed-color')
        .setDescription('Set the embed color (hex format)')
        .addStringOption(option =>
          option
            .setName('color')
            .setDescription('Color in hex format (e.g., #FF0000)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('embed-title')
        .setDescription('Set the embed title')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('The embed title (max 256 chars)')
            .setMaxLength(256)
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
          config.leave.enabled = enabled;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          return interaction.editReply(
            successReply(
              'Leave Messages',
              `Leave messages are now **${enabled ? 'enabled' : 'disabled'}**.`
            )
          );
        }

        case 'channel': {
          const channel = interaction.options.getChannel('channel', true) as TextChannel;
          config.leave.channelId = channel.id;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          return interaction.editReply(
            successReply(
              'Leave Channel Updated',
              `Leave messages will now be sent to ${channel}.`
            )
          );
        }

        case 'message': {
          const message = interaction.options.getString('message', true);
          config.leave.message = message;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const placeholders = '{user}, {username}, {server}, {membercount}, {usertag}, {createdate}, {joindate}, {id}';
          return interaction.editReply(
            successReply(
              'Leave Message Updated',
              `Available placeholders:\n\`${placeholders}\``
            )
          );
        }

        case 'embed': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.leave.useEmbed = enabled;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          return interaction.editReply(
            successReply(
              'Leave Embed Mode',
              `Embed mode is now **${enabled ? 'enabled' : 'disabled'}**.`
            )
          );
        }

        case 'embed-color': {
          const color = interaction.options.getString('color', true);

          // Validate hex color
          if (!/^#[0-9A-F]{6}$/i.test(color)) {
            return interaction.editReply(
              errorReply(
                'Invalid Color',
                'Please provide a valid hex color (e.g., #FF0000).'
              )
            );
          }

          config.leave.embedColor = color;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          return interaction.editReply(
            successReply(
              'Embed Color Updated',
              `Embed color is now set to \`${color}\`.`
            )
          );
        }

        case 'embed-title': {
          const title = interaction.options.getString('title', true);
          config.leave.embedTitle = title;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          return interaction.editReply(
            successReply(
              'Embed Title Updated',
              `Embed title is now: **${title}**`
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
      console.error('[Leave Command Error]', error);
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
