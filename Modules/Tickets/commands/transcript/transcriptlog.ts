import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType, MessageFlags } from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { moduleConfig } from '../../../../Shared/src/middleware/moduleConfig';
import { Colors, successEmbed, errorEmbed, warningEmbed, infoEmbed } from '../../../../Shared/src/utils/embed';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.staff.transcriptlog',
  defaultPermissions: [PermissionFlagsBits.ManageGuild],
  data: new SlashCommandBuilder()
    .setName('transcriptlog')
    .setDescription('Set or disable the transcript log channel')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The text channel to log transcripts to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName('disable')
        .setDescription('Disable transcript logging')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const _cfgResult = await moduleConfig.getModuleConfig(interaction.guildId!, 'tickets');
    const config = (_cfgResult?.config ?? {}) as any;

    if (!config?.enabled) {
      return interaction.reply({
        content: '❌ The tickets module is not enabled on this server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Check if user has ManageGuild permission
    const permissions = interaction.member?.permissions;
    if (
      typeof permissions === 'string' || !permissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      return interaction.reply({
        content: '❌ You need the Manage Guild permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const channel = interaction.options.getChannel('channel');
    const disable = interaction.options.getBoolean('disable');

    if (disable) {
      // Disable transcript logging
      config.transcriptChannelId = undefined;
      moduleConfig.setConfig(interaction.guildId!, 'tickets', config);

      const embed = successEmbed(
        'Transcript Log Disabled',
        'Transcripts will no longer be automatically logged to a channel.'
      );

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!channel) {
      return interaction.reply({
        content: '❌ Please specify a channel or use the `disable` option.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Set transcript log channel
    config.transcriptChannelId = channel.id;
    moduleConfig.setConfig(interaction.guildId!, 'tickets', config);

    const embed = successEmbed(
      'Transcript Log Channel Set',
      `Transcripts will be logged to ${channel.toString()}`
    );

    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
