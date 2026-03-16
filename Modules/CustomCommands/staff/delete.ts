import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { CustomCommandsHelper } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, errorContainer, addText, addFields, addButtons, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { ContainerBuilder } from 'discord.js';
const logger = createModuleLogger('CustomCommands');

export const deleteCommand: BotCommand = {
  module: 'customcommands',
  permissionPath: 'customcommands.delete',
  data: new SlashCommandBuilder()
    .setName('cdelete')
    .setDescription('Delete a custom command')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Name of the custom command to delete')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ,

  async execute(interaction: ChatInputCommandInteraction, helpers: any) {
    const helper = helpers.customcommands as CustomCommandsHelper;

    if (!interaction.guild || !interaction.member) {
      await interaction.reply({
        content: 'This command can only be used in a server.'
      });
      return;
    }

    // Check permission
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need the "Manage Guild" permission to use this command.'
      });
      return;
    }

    try {
      const name = interaction.options.getString('name', true).toLowerCase();
      const command = await helper.getCommand(interaction.guildId!, name);

      if (!command) {
        await interaction.reply({
          content: `Custom command "${name}" not found.`
        });
        return;
      }

      // Confirmation container
      const container = errorContainer('Confirm Deletion', `Are you sure you want to delete the custom command **${command.name}**?`);
      addFields(container, [
        { name: 'Uses', value: String(command.useCount || 0), inline: true },
        { name: 'Created', value: command.createdAt?.toLocaleDateString() || 'Unknown', inline: true }
      ]);

      const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_delete')
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_delete')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      addButtons(container, [confirmButton, cancelButton]);

      const response = await interaction.reply(v2Payload([container]));

      // Wait for button click
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000
      });

      let confirmed = false;

      collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.user.id !== interaction.user.id) {
          await buttonInteraction.reply({
            content: 'You cannot interact with this button.'
          });
          return;
        }

        if (buttonInteraction.customId === 'confirm_delete') {
          confirmed = true;
          await helper.deleteCommand(command.id);

          const successContainer = moduleContainer('custom_commands');
          addText(successContainer, `### Command Deleted\nCustom command **${command.name}** has been deleted.`);

          await buttonInteraction.update(v2Payload([successContainer]));

          logger.info(`Custom command deleted: ${name} by ${interaction.user.id} in ${interaction.guildId!}`);
        } else if (buttonInteraction.customId === 'cancel_delete') {
          const cancelContainer = moduleContainer('custom_commands');
          addText(cancelContainer, `### Deletion Cancelled\nThe custom command was not deleted.`);

          await buttonInteraction.update(v2Payload([cancelContainer]));
        }

        collector.stop();
      });

      collector.on('end', async () => {
        if (!confirmed) {
          try {
            await response.edit(v2Payload([container]));
          } catch (error) {
            logger.warn('Failed to remove buttons after timeout', error);
          }
        }
      });
    } catch (error) {
      logger.error('Failed to delete custom command', error);
      await interaction.reply({
        content: 'Failed to delete custom command. Please try again later.'
      });
    }
  }
};

export default deleteCommand;
