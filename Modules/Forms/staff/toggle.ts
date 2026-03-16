import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Forms');
import { getFormById, toggleFormActive } from '../helpers';
import { moduleContainer, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('formtoggle')
    .setDescription('Enable or disable a form')
    .addStringOption((option) =>
      option
        .setName('formid')
        .setDescription('The ID of the form to toggle')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  module: 'forms',
  permissionPath: 'forms.toggle',
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const guildId = interaction.guildId!;
      if (!guildId) {
        await interaction.editReply({ content: '❌ This command can only be used in a server.' });
        return;
      }

      const formId = interaction.options.getString('formid', true);

      const form = await getFormById(formId);
      if (!form || form.guildId !== guildId) {
        await interaction.editReply({ content: '❌ Form not found.' });
        return;
      }

      const updatedForm = await toggleFormActive(formId, !form.isActive);
      if (!updatedForm) {
        await interaction.editReply({ content: '❌ Failed to toggle form status.' });
        return;
      }

      const container = moduleContainer('forms');
      addFields(container, [
        { name: 'Form Name', value: updatedForm.name, inline: true },
        { name: 'Form ID', value: updatedForm.id, inline: true },
        { name: 'Status', value: updatedForm.isActive ? '✅ Active' : '❌ Inactive', inline: false }
      ]);

      await interaction.editReply(v2Payload([container]));

      logger.info(
        `[Forms] Form toggled - ID: ${formId}, Guild: ${guildId}, New Status: ${updatedForm.isActive ? 'Active' : 'Inactive'}`
      );
    } catch (error) {
      logger.error('[Forms] /formtoggle error:', error);
      await interaction.editReply({ content: '❌ An error occurred while toggling the form.' });
    }
  },
};

export default command;
