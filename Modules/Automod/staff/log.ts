import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getAutomodConfig, AutomodConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

const command: BotCommand = {
  module: 'automod',
  permissionPath: 'automod.staff.log',
  allowDM: false,
  defaultPermissions: PermissionFlagsBits.ManageGuild,
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('automod-log')
    .setDescription('Configure the automod logging channel')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set the channel for automod logs')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Text channel to send automod logs to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('disable').setDescription('Disable automod logging')
    )
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View the current log channel')
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      const config = await getAutomodConfig(guildId);
      const subcommand = interaction.options.getSubcommand();

      let responseEmbed: EmbedBuilder;
      let updated = false;

      switch (subcommand) {
        case 'set': {
          const channel = interaction.options.getChannel('channel', true);

          // Verify it's a text channel
          if (channel.type !== ChannelType.GuildText) {
            responseEmbed = errorEmbed(
              'Invalid Channel',
              'The log channel must be a text channel.'
            );
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
          }

          // Verify bot has permissions to write to the channel
          const botPermissions = (channel as any).permissionsFor(
            interaction.client.user
          );
          if (
            !botPermissions ||
            !botPermissions.has([
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
            ])
          ) {
            responseEmbed = errorEmbed(
              'Insufficient Permissions',
              `I don't have permission to send messages in ${channel.name}.`
            );
            await interaction.editReply({ embeds: [responseEmbed] });
            return;
          }

          config.logChannelId = channel.id;
          updated = true;

          responseEmbed = successEmbed(
            'Log Channel Set',
            `Automod logs will be sent to ${channel.name}.`
          );
          break;
        }

        case 'disable': {
          config.logChannelId = undefined;
          updated = true;

          responseEmbed = successEmbed(
            'Logging Disabled',
            'Automod logging has been disabled.'
          );
          break;
        }

        case 'view': {
          const embed = new EmbedBuilder()
            .setColor(Colors.Info)
            .setTitle('Automod Log Channel');

          if (config.logChannelId) {
            embed.setDescription(`Log Channel: <#${config.logChannelId}>`);
            embed.addFields({
              name: 'Status',
              value: 'Logging is **enabled**',
              inline: false,
            });
          } else {
            embed.setDescription('No log channel is currently configured.');
            embed.addFields({
              name: 'Status',
              value: 'Logging is **disabled**',
              inline: false,
            });
          }

          responseEmbed = embed;
          break;
        }

        default:
          responseEmbed = errorEmbed('Invalid Subcommand', 'An error occurred.');
      }

      if (updated) {
        await moduleConfig.setConfig(guildId, 'automod', config);
      }

      await interaction.editReply({ embeds: [responseEmbed] });
    } catch (error) {
      console.error('Error in automod-log command:', error);
      const embed = errorEmbed(
        'Command Error',
        'An error occurred while processing your request.'
      );
      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
