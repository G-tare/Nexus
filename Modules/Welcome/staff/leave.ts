import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getWelcomeConfig, WelcomeConfig } from '../helpers';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  module: 'welcome',
  permissionPath: 'welcome.staff.leave',
  premiumFeature: 'welcome.basic',
  defaultPermissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Configure leave messages')
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

          const embed = successEmbed(
            'Leave Messages',
            `Leave messages are now **${enabled ? 'enabled' : 'disabled'}**.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'channel': {
          const channel = interaction.options.getChannel('channel', true) as TextChannel;
          config.leave.channelId = channel.id;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Leave Channel Updated',
            `Leave messages will now be sent to ${channel}.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'message': {
          const message = interaction.options.getString('message', true);
          config.leave.message = message;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const placeholders = '{user}, {username}, {server}, {membercount}, {usertag}, {createdate}, {joindate}, {id}';
          const embed = successEmbed(
            'Leave Message Updated',
            `Available placeholders:\n\`${placeholders}\``
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'embed': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.leave.useEmbed = enabled;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Leave Embed Mode',
            `Embed mode is now **${enabled ? 'enabled' : 'disabled'}**.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'embed-color': {
          const color = interaction.options.getString('color', true);

          // Validate hex color
          if (!/^#[0-9A-F]{6}$/i.test(color)) {
            const embed = errorEmbed(
              'Invalid Color',
              'Please provide a valid hex color (e.g., #FF0000).'
            ).setColor(Colors.Error);
            return interaction.editReply({ embeds: [embed] });
          }

          config.leave.embedColor = color;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Embed Color Updated',
            `Embed color is now set to \`${color}\`.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'embed-title': {
          const title = interaction.options.getString('title', true);
          config.leave.embedTitle = title;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Embed Title Updated',
            `Embed title is now: **${title}**`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        default: {
          const embed = errorEmbed('Unknown Subcommand', 'An unknown subcommand was provided.').setColor(Colors.Error);
          return interaction.editReply({ embeds: [embed] });
        }
      }
    } catch (error) {
      console.error('[Leave Command Error]', error);
      const embed = errorEmbed(
        'Error',
        'An error occurred while processing your command.'
      ).setColor(Colors.Error);
      return interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
