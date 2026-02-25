import {  SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('StickyMessages');
import { StickyMessagesHelper } from '../helpers';
import type { BotCommand } from '../../../Shared/src/types/command';


const stickyConfigCommand: BotCommand = {
  module: 'stickymessages',
  permissionPath: 'staff.stickymessages.config',
  data: new SlashCommandBuilder()
    .setName('stickyconfig')
    .setDescription('Configure sticky messages for this guild')
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View current sticky messages configuration')
    )
    .addSubcommand((sub) =>
      sub
        .setName('mode')
        .setDescription('Set the re-stick mode')
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('How to determine when to re-stick')
            .addChoices(
              { name: 'Interval', value: 'interval' },
              { name: 'Activity-based', value: 'activity' },
              { name: 'Hybrid (Interval + Activity)', value: 'hybrid' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('enabled')
        .setDescription('Enable or disable sticky messages')
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable or disable')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('maxstickies')
        .setDescription('Set max stickies per channel')
        .addIntegerOption((option) =>
          option
            .setName('count')
            .setDescription('Maximum number of stickies per channel')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('deleteoldmessage')
        .setDescription('Whether to delete old sticky messages when resending')
        .addBooleanOption((option) =>
          option
            .setName('delete')
            .setDescription('Delete old message')
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction: any, db: any) {
    try {
      await interaction.deferReply();

      const helper = new StickyMessagesHelper(db);
      const subcommand = interaction.options.getSubcommand();
      const config = await helper.getGuildConfig(interaction.guildId!);

      if (subcommand === 'view') {
        const modeDescriptions: Record<string, string> = {
          interval: 'Re-stick after a fixed number of messages',
          activity:
            'Re-stick based on channel activity (3-15 messages depending on activity)',
          hybrid: 'Re-stick after interval, but adjust up based on activity',
        };

        const response = `
**Sticky Messages Configuration**
- **Enabled**: ${config.enabled ? 'Yes' : 'No'}
- **Mode**: ${config.mode} - ${modeDescriptions[config.mode]}
- **Max stickies per channel**: ${config.maxStickiesPerChannel}
- **Delete old message**: ${config.deleteBotMessage ? 'Yes' : 'No'}
        `.trim();

        await interaction.editReply({ content: response });
      } else if (subcommand === 'mode') {
        const mode = interaction.options.getString('mode', true) as
          | 'interval'
          | 'activity'
          | 'hybrid';
        await helper.updateGuildConfig(interaction.guildId!, { mode });

        logger.info(
          `Updated sticky messages mode to ${mode} in guild ${interaction.guildId!}`
        );

        await interaction.editReply({
          content: `Sticky message mode changed to **${mode}**.`,
        });

        if (interaction.client.emit) {
          interaction.client.emit('auditLog', {
            type: 'STICKY_CONFIG_UPDATED',
            userId: interaction.user.id,
            guildId: interaction.guildId!,
            details: { setting: 'mode', value: mode },
          });
        }
      } else if (subcommand === 'enabled') {
        const enabled = interaction.options.getBoolean('enabled', true);
        await helper.updateGuildConfig(interaction.guildId!, { enabled });

        logger.info(
          `${enabled ? 'Enabled' : 'Disabled'} sticky messages in guild ${interaction.guildId!}`
        );

        await interaction.editReply({
          content: `Sticky messages are now **${enabled ? 'enabled' : 'disabled'}**.`,
        });

        if (interaction.client.emit) {
          interaction.client.emit('auditLog', {
            type: 'STICKY_CONFIG_UPDATED',
            userId: interaction.user.id,
            guildId: interaction.guildId!,
            details: { setting: 'enabled', value: enabled },
          });
        }
      } else if (subcommand === 'maxstickies') {
        const count = interaction.options.getInteger('count', true);
        await helper.updateGuildConfig(interaction.guildId!, {
          maxStickiesPerChannel: count,
        });

        logger.info(
          `Updated max stickies per channel to ${count} in guild ${interaction.guildId!}`
        );

        await interaction.editReply({
          content: `Max stickies per channel set to **${count}**.`,
        });

        if (interaction.client.emit) {
          interaction.client.emit('auditLog', {
            type: 'STICKY_CONFIG_UPDATED',
            userId: interaction.user.id,
            guildId: interaction.guildId!,
            details: { setting: 'maxStickiesPerChannel', value: count },
          });
        }
      } else if (subcommand === 'deleteoldmessage') {
        const deleteOld = interaction.options.getBoolean('delete', true);
        await helper.updateGuildConfig(interaction.guildId!, {
          deleteBotMessage: deleteOld,
        });

        logger.info(
          `${deleteOld ? 'Enabled' : 'Disabled'} old message deletion in guild ${interaction.guildId!}`
        );

        await interaction.editReply({
          content: `Old sticky messages will now be **${deleteOld ? 'deleted' : 'kept'}** when resending.`,
        });

        if (interaction.client.emit) {
          interaction.client.emit('auditLog', {
            type: 'STICKY_CONFIG_UPDATED',
            userId: interaction.user.id,
            guildId: interaction.guildId!,
            details: { setting: 'deleteBotMessage', value: deleteOld },
          });
        }
      }
    } catch (error) {
      logger.error(`Error in stickyconfig command: ${error}`);
      await interaction.editReply({
        content: 'An error occurred while updating the configuration.',
      });
    }
  },
};

export default stickyConfigCommand;
