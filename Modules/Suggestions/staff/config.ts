import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getSuggestionConfig, setSuggestionConfig } from '../helpers';

const configCommand: BotCommand = {
  module: 'suggestions',
  permissionPath: 'suggestions.suggestion-config',
  category: 'engagement',
  data: new SlashCommandBuilder()
    .setName('suggestion-config')
    .setDescription('Configure suggestion settings')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('View all suggestion settings'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('channel')
        .setDescription('Set the suggestion channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The channel where suggestions will be posted')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('anonymous')
        .setDescription('Toggle anonymous suggestion mode'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('emojis')
        .setDescription('Set vote emojis')
        .addStringOption((option) =>
          option
            .setName('upvote')
            .setDescription('Emoji for upvote')
            .setRequired(true)
            .setMaxLength(10),
        )
        .addStringOption((option) =>
          option
            .setName('downvote')
            .setDescription('Emoji for downvote')
            .setRequired(true)
            .setMaxLength(10),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('thread')
        .setDescription('Toggle auto-thread creation for suggestions'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('require-reason')
        .setDescription('Toggle requiring reason on status changes'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('dm-notify')
        .setDescription('Toggle DM notifications to users on status change'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('editing')
        .setDescription('Toggle author editing of suggestions'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('colors')
        .setDescription('Set status colors')
        .addStringOption((option) =>
          option
            .setName('status')
            .setDescription('Which status color to change')
            .setRequired(true)
            .addChoices(
              { name: 'Pending', value: 'pending' },
              { name: 'Approved', value: 'approved' },
              { name: 'Denied', value: 'denied' },
              { name: 'Considering', value: 'considering' },
              { name: 'Implemented', value: 'implemented' },
            ),
        )
        .addStringOption((option) =>
          option
            .setName('color')
            .setDescription('Hex color code (e.g., #FF9B05)')
            .setRequired(true)
            .setMaxLength(7),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      // Check permissions
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          content: 'You need `Manage Guild` permission to use this command.',
          ephemeral: true,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const config = await getSuggestionConfig(interaction.guildId!);

      if (subcommand === 'view') {
        const embed = new EmbedBuilder()
          .setTitle('Suggestion Settings')
          .setColor('#FF9B05')
          .setFields(
            { name: 'Enabled', value: config.enabled ? 'Yes' : 'No', inline: true },
            {
              name: 'Suggestion Channel',
              value: config.channelId ? `<#${config.channelId}>` : 'Not set',
              inline: true,
            },
            { name: 'Anonymous Mode', value: config.anonymous ? 'Yes' : 'No', inline: true },
            {
              name: 'Vote Emojis',
              value: `Upvote: ${config.upvoteEmoji} | Downvote: ${config.downvoteEmoji}`,
              inline: true,
            },
            { name: 'Auto-Thread', value: config.autoThread ? 'Yes' : 'No', inline: true },
            { name: 'Require Reason', value: config.requireReason ? 'Yes' : 'No', inline: true },
            { name: 'DM Notifications', value: config.dmOnStatusChange ? 'Yes' : 'No', inline: true },
            { name: 'Author Editing', value: config.allowEditing ? 'Yes' : 'No', inline: true },
            { name: 'Pending Color', value: config.embedColor, inline: true },
            { name: 'Approved Color', value: config.approvedColor, inline: true },
            { name: 'Denied Color', value: config.deniedColor, inline: true },
            { name: 'Considering Color', value: config.consideringColor, inline: true },
            { name: 'Implemented Color', value: config.implementedColor, inline: true },
          );

        await interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
        return;
      }

      if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('channel');
        await setSuggestionConfig(interaction.guildId!, { channelId: channel!.id });

        await interaction.reply({
          content: `✅ Suggestion channel set to ${channel}`,
          ephemeral: true,
        });
        return;
      }

      if (subcommand === 'anonymous') {
        const newValue = !config.anonymous;
        await setSuggestionConfig(interaction.guildId!, { anonymous: newValue });

        await interaction.reply({
          content: `✅ Anonymous mode is now ${newValue ? 'enabled' : 'disabled'}`,
          ephemeral: true,
        });
        return;
      }

      if (subcommand === 'emojis') {
        const upvote = interaction.options.getString('upvote', true);
        const downvote = interaction.options.getString('downvote', true);

        await setSuggestionConfig(interaction.guildId!, {
          upvoteEmoji: upvote,
          downvoteEmoji: downvote,
        });

        await interaction.reply({
          content: `✅ Vote emojis updated to ${upvote} and ${downvote}`,
          ephemeral: true,
        });
        return;
      }

      if (subcommand === 'thread') {
        const newValue = !config.autoThread;
        await setSuggestionConfig(interaction.guildId!, { autoThread: newValue });

        await interaction.reply({
          content: `✅ Auto-thread is now ${newValue ? 'enabled' : 'disabled'}`,
          ephemeral: true,
        });
        return;
      }

      if (subcommand === 'require-reason') {
        const newValue = !config.requireReason;
        await setSuggestionConfig(interaction.guildId!, { requireReason: newValue });

        await interaction.reply({
          content: `✅ Require reason is now ${newValue ? 'enabled' : 'disabled'}`,
          ephemeral: true,
        });
        return;
      }

      if (subcommand === 'dm-notify') {
        const newValue = !config.dmOnStatusChange;
        await setSuggestionConfig(interaction.guildId!, { dmOnStatusChange: newValue });

        await interaction.reply({
          content: `✅ DM notifications are now ${newValue ? 'enabled' : 'disabled'}`,
          ephemeral: true,
        });
        return;
      }

      if (subcommand === 'editing') {
        const newValue = !config.allowEditing;
        await setSuggestionConfig(interaction.guildId!, { allowEditing: newValue });

        await interaction.reply({
          content: `✅ Author editing is now ${newValue ? 'enabled' : 'disabled'}`,
          ephemeral: true,
        });
        return;
      }

      if (subcommand === 'colors') {
        const status = interaction.options.getString('status', true);
        const color = interaction.options.getString('color', true);

        // Validate hex color
        if (!/#[0-9A-F]{6}/i.test(color)) {
          await interaction.reply({
            content: 'Invalid hex color. Use format: #FF9B05',
            ephemeral: true,
          });
          return;
        }

        const updates: any = {};
        if (status === 'pending') updates.embedColor = color;
        else if (status === 'approved') updates.approvedColor = color;
        else if (status === 'denied') updates.deniedColor = color;
        else if (status === 'considering') updates.consideringColor = color;
        else if (status === 'implemented') updates.implementedColor = color;

        await setSuggestionConfig(interaction.guildId!, updates);

        await interaction.reply({
          content: `✅ ${status!.charAt(0).toUpperCase() + status.slice(1)} color changed to ${color}`,
          ephemeral: true,
        });
        return;
      }
    } catch (error) {
      console.error('Error in suggestion-config command:', error);
      await interaction.reply({
        content: 'An error occurred while updating configuration.',
        ephemeral: true,
      });
    }
  },
};

export default configCommand;
