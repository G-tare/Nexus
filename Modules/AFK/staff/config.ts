import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAFKConfig, setAFKConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

const command: BotCommand = {
  module: 'afk',
  permissionPath: 'afk.afk-config',
  data: new SlashCommandBuilder()
    .setName('afk-config')
    .setDescription('Configure AFK module settings (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View current AFK configuration')
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable AFK module')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable or disable AFK')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-length')
        .setDescription('Set maximum AFK message length')
        .addIntegerOption((opt) =>
          opt
            .setName('length')
            .setDescription('Max characters for AFK message (10-500)')
            .setRequired(true)
            .setMinValue(10)
            .setMaxValue(500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('dm-pings')
        .setDescription('Toggle DM pings on return')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Send DM with pings when returning')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-pings')
        .setDescription('Set maximum pings to track per user')
        .addIntegerOption((opt) =>
          opt
            .setName('max')
            .setDescription('Max pings to store (10-200)')
            .setRequired(true)
            .setMinValue(10)
            .setMaxValue(200)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('auto-remove')
        .setDescription('Toggle auto-remove AFK on message')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Auto-remove AFK when user sends message')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('log-channel')
        .setDescription('Set log channel for AFK events')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Text channel for logs (optional)')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommand = interaction.options.getSubcommand();
      const config = await getAFKConfig(interaction.guildId!);

      if (subcommand === 'view') {
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('AFK Module Configuration')
          .addFields(
            {
              name: 'Enabled',
              value: config.enabled ? '✅ Yes' : '❌ No',
              inline: true,
            },
            {
              name: 'Max Message Length',
              value: `${config.maxMessageLength} characters`,
              inline: true,
            },
            {
              name: 'DM Pings on Return',
              value: config.dmPingsOnReturn ? '✅ Yes' : '❌ No',
              inline: true,
            },
            {
              name: 'Max Pings to Track',
              value: `${config.maxPingsToTrack}`,
              inline: true,
            },
            {
              name: 'Auto-Remove on Message',
              value: config.autoRemoveOnMessage ? '✅ Yes' : '❌ No',
              inline: true,
            },
            {
              name: 'Log Channel',
              value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not set',
              inline: true,
            },
            {
              name: 'Banned Users',
              value: config.bannedUsers.length > 0 ? `${config.bannedUsers.length} users` : 'None',
              inline: false,
            }
          )
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled')!;
        await setAFKConfig(interaction.guildId!, { enabled });
        await moduleConfig.setConfig(interaction.guildId!, 'afk', { enabled });

        return await interaction.editReply({
          content: `✅ AFK module is now ${enabled ? 'enabled' : 'disabled'}.`,
        });
      }

      if (subcommand === 'max-length') {
        const length = interaction.options.getInteger('length')!;
        await setAFKConfig(interaction.guildId!, { maxMessageLength: length });
        await moduleConfig.setConfig(interaction.guildId!, 'afk', { maxMessageLength: length });

        return await interaction.editReply({
          content: `✅ Max AFK message length set to ${length} characters.`,
        });
      }

      if (subcommand === 'dm-pings') {
        const enabled = interaction.options.getBoolean('enabled')!;
        await setAFKConfig(interaction.guildId!, { dmPingsOnReturn: enabled });
        await moduleConfig.setConfig(interaction.guildId!, 'afk', { dmPingsOnReturn: enabled });

        return await interaction.editReply({
          content: `✅ DM pings on return is now ${enabled ? 'enabled' : 'disabled'}.`,
        });
      }

      if (subcommand === 'max-pings') {
        const max = interaction.options.getInteger('max')!;
        await setAFKConfig(interaction.guildId!, { maxPingsToTrack: max });
        await moduleConfig.setConfig(interaction.guildId!, 'afk', { maxPingsToTrack: max });

        return await interaction.editReply({
          content: `✅ Max pings to track set to ${max}.`,
        });
      }

      if (subcommand === 'auto-remove') {
        const enabled = interaction.options.getBoolean('enabled')!;
        await setAFKConfig(interaction.guildId!, { autoRemoveOnMessage: enabled });
        await moduleConfig.setConfig(interaction.guildId!, 'afk', { autoRemoveOnMessage: enabled });

        return await interaction.editReply({
          content: `✅ Auto-remove on message is now ${enabled ? 'enabled' : 'disabled'}.`,
        });
      }

      if (subcommand === 'log-channel') {
        const channel = interaction.options.getChannel('channel');
        const logChannelId = channel?.id;

        await setAFKConfig(interaction.guildId!, { logChannelId });
        await moduleConfig.setConfig(interaction.guildId!, 'afk', { logChannelId });

        if (logChannelId) {
          return await interaction.editReply({
            content: `✅ Log channel set to <#${logChannelId}>.`,
          });
        } else {
          return await interaction.editReply({
            content: '✅ Log channel cleared.',
          });
        }
      }
    } catch (error) {
      console.error('Error in /afk-config command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while updating configuration.',
      });
    }
  },
};

export default command;
