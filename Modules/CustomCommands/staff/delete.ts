import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { CustomCommandsHelper } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
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
        content: 'This command can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    // Check permission
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need the "Manage Guild" permission to use this command.',
        ephemeral: true
      });
      return;
    }

    try {
      const name = interaction.options.getString('name', true).toLowerCase();
      const command = await helper.getCommand(interaction.guildId!, name);

      if (!command) {
        await interaction.reply({
          content: `Custom command "${name}" not found.`,
          ephemeral: true
        });
        return;
      }

      // Confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setTitle('Confirm Deletion')
        .setDescription(`Are you sure you want to delete the custom command **${command.name}**?`)
        .setColor('#ff4444')
        .addFields(
          { name: 'Uses', value: String(command.useCount || 0), inline: true },
          { name: 'Created', value: command.createdAt?.toLocaleDateString() || 'Unknown', inline: true }
        );

      const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_delete')
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_delete')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(confirmButton, cancelButton);

      const response = await interaction.reply({
        embeds: [confirmEmbed],
        components: [row],
        ephemeral: true
      });

      // Wait for button click
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000
      });

      let confirmed = false;

      collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.user.id !== interaction.user.id) {
          await buttonInteraction.reply({
            content: 'You cannot interact with this button.',
            ephemeral: true
          });
          return;
        }

        if (buttonInteraction.customId === 'confirm_delete') {
          confirmed = true;
          await helper.deleteCommand(command.id);

          const successEmbed = new EmbedBuilder()
            .setTitle('Command Deleted')
            .setDescription(`Custom command **${command.name}** has been deleted.`)
            .setColor('#2f3136');

          await buttonInteraction.update({
            embeds: [successEmbed],
            components: []
          });

          logger.info(`Custom command deleted: ${name} by ${interaction.user.id} in ${interaction.guildId!}`);
        } else if (buttonInteraction.customId === 'cancel_delete') {
          const cancelEmbed = new EmbedBuilder()
            .setTitle('Deletion Cancelled')
            .setDescription('The custom command was not deleted.')
            .setColor('#2f3136');

          await buttonInteraction.update({
            embeds: [cancelEmbed],
            components: []
          });
        }

        collector.stop();
      });

      collector.on('end', async () => {
        if (!confirmed) {
          try {
            await response.edit({
              components: []
            });
          } catch (error) {
            logger.warn('Failed to remove buttons after timeout', error);
          }
        }
      });
    } catch (error) {
      logger.error('Failed to delete custom command', error);
      await interaction.reply({
        content: 'Failed to delete custom command. Please try again later.',
        ephemeral: true
      });
    }
  }
};

export default deleteCommand;
