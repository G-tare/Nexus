import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Forms');
import { getFormById, deleteForm } from '../helpers';
import { errorContainer, addButtons, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('formdelete')
    .setDescription('Delete a form and all its responses')
    .addStringOption((option) =>
      option
        .setName('formid')
        .setDescription('The ID of the form to delete')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  module: 'forms',
  permissionPath: 'forms.delete',
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      if (!guildId) {
        await interaction.reply({ content: '❌ This command can only be used in a server.' });
        return;
      }

      const formId = interaction.options.getString('formid', true);

      const form = await getFormById(formId);
      if (!form || form.guildId !== guildId) {
        await interaction.reply({ content: '❌ Form not found.' });
        return;
      }

      const container = errorContainer('Confirm Form Deletion', `Are you sure you want to delete the form **${form.name}**?\n\nThis action will delete the form and all ${form.responseChannelId ? '(unknown number of)' : '0'} associated responses and cannot be undone.`);

      const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_delete_form_${formId}`)
        .setLabel('Confirm Delete')
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_form_delete')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      addButtons(container, [confirmButton, cancelButton]);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      logger.error('[Forms] /formdelete error:', error);
      await interaction.reply({ content: '❌ An error occurred while deleting the form.' });
    }
  },
};

export default command;
