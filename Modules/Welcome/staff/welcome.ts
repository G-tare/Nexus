import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getWelcomeConfig, WelcomeConfig } from '../helpers';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  module: 'welcome',
  permissionPath: 'welcome.staff.welcome',
  premiumFeature: 'welcome.basic',
  defaultPermissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome messages')
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Enable or disable welcome messages')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Whether welcome messages are enabled')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel')
        .setDescription('Set the channel for welcome messages')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('The channel to send welcome messages to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('message')
        .setDescription('Set the welcome message text')
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('The welcome message (max 2000 chars)')
            .setMaxLength(2000)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('embed')
        .setDescription('Toggle embed mode for welcome messages')
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
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('embed-footer')
        .setDescription('Set the embed footer')
        .addStringOption(option =>
          option
            .setName('footer')
            .setDescription('The embed footer (max 2048 chars)')
            .setMaxLength(2048)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('embed-thumbnail')
        .setDescription('Toggle showing user avatar as embed thumbnail')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Whether to show user avatar as thumbnail')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('image')
        .setDescription('Toggle canvas welcome image generation')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Whether to generate canvas welcome images')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('image-background')
        .setDescription('Set custom background URL for canvas image')
        .addStringOption(option =>
          option
            .setName('url')
            .setDescription('Background image URL')
            .setRequired(true)
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guildId = interaction.guildId!;
      const subcommand = interaction.options.getSubcommand();
      const config = await getWelcomeConfig(guildId);

      switch (subcommand) {
        case 'toggle': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.welcome.enabled = enabled;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Welcome Messages',
            `Welcome messages are now **${enabled ? 'enabled' : 'disabled'}**.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'channel': {
          const channel = interaction.options.getChannel('channel', true) as TextChannel;
          config.welcome.channelId = channel.id;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Welcome Channel Updated',
            `Welcome messages will now be sent to ${channel}.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'message': {
          const message = interaction.options.getString('message', true);
          config.welcome.message = message;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const placeholders = '{user}, {username}, {server}, {membercount}, {usertag}, {createdate}, {joindate}, {id}';
          const embed = successEmbed(
            'Welcome Message Updated',
            `Available placeholders:\n\`${placeholders}\``
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'embed': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.welcome.useEmbed = enabled;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Welcome Embed Mode',
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

          config.welcome.embedColor = color;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Embed Color Updated',
            `Embed color is now set to \`${color}\`.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'embed-title': {
          const title = interaction.options.getString('title', true);
          config.welcome.embedTitle = title;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Embed Title Updated',
            `Embed title is now: **${title}**`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'embed-footer': {
          const footer = interaction.options.getString('footer', true);
          config.welcome.embedFooter = footer;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Embed Footer Updated',
            `Embed footer is now: **${footer}**`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'embed-thumbnail': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.welcome.embedThumbnail = enabled;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Embed Thumbnail',
            `User avatar thumbnail is now **${enabled ? 'shown' : 'hidden'}**.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'image': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.welcome.showImage = enabled;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Canvas Welcome Image',
            `Canvas images are now **${enabled ? 'enabled' : 'disabled'}**.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        case 'image-background': {
          const url = interaction.options.getString('url', true);
          config.welcome.imageBackground = url;
          await moduleConfig.setConfig(guildId, 'welcome', config);

          const embed = successEmbed(
            'Image Background Updated',
            `Custom background URL has been set.`
          ).setColor(Colors.Success);

          return interaction.editReply({ embeds: [embed] });
        }

        default: {
          const embed = errorEmbed('Unknown Subcommand', 'An unknown subcommand was provided.').setColor(Colors.Error);
          return interaction.editReply({ embeds: [embed] });
        }
      }
    } catch (error) {
      console.error('[Welcome Command Error]', error);
      const embed = errorEmbed(
        'Error',
        'An error occurred while processing your command.'
      ).setColor(Colors.Error);
      return interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
