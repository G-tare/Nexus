import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFields, addSeparator, successReply, errorReply } from '../../../Shared/src/utils/componentsV2';
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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

      let updated = false;

      switch (subcommand) {
        case 'set': {
          const channel = interaction.options.getChannel('channel', true);

          // Verify it's a text channel
          if (channel.type !== ChannelType.GuildText) {
            await interaction.editReply(errorReply('Invalid Channel', 'The log channel must be a text channel.'));
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
            await interaction.editReply(errorReply(
              'Insufficient Permissions',
              `I don't have permission to send messages in ${channel.name}.`
            ));
            return;
          }

          config.logChannelId = channel.id;
          updated = true;

          await interaction.editReply(successReply(
            'Log Channel Set',
            `Automod logs will be sent to ${channel.name}.`
          ));
          break;
        }

        case 'disable': {
          config.logChannelId = undefined;
          updated = true;

          await interaction.editReply(successReply(
            'Logging Disabled',
            'Automod logging has been disabled.'
          ));
          break;
        }

        case 'view': {
          const container = moduleContainer('automod');
          addText(container, '### Automod Log Channel');
          addSeparator(container, 'small');

          const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
          if (config.logChannelId) {
            addText(container, `Log Channel: <#${config.logChannelId}>`);
            fields.push({
              name: 'Status',
              value: 'Logging is **enabled**',
            });
          } else {
            addText(container, 'No log channel is currently configured.');
            fields.push({
              name: 'Status',
              value: 'Logging is **disabled**',
            });
          }

          addFields(container, fields);
          await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
          break;
        }

        default:
          await interaction.editReply(errorReply('Invalid Subcommand', 'An error occurred.'));
      }

      if (updated) {
        await moduleConfig.setConfig(guildId, 'automod', config);
      }
    } catch (error) {
      console.error('Error in automod-log command:', error);
      await interaction.editReply(errorReply('Command Error', 'An error occurred while processing your request.'));
    }
  },
};

export default command;
