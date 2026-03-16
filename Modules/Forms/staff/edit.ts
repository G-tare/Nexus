import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Forms');
import { getFormById, updateForm, FormQuestion } from '../helpers';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('formedit')
    .setDescription('Edit a form and manage its questions')
    .addSubcommand((sub: any) =>
      sub
        .setName('addquestion')
        .setDescription('Add a question to the form')
        .addStringOption((opt: any) =>
          opt
            .setName('formid')
            .setDescription('The ID of the form to edit')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((opt: any) =>
          opt
            .setName('label')
            .setDescription('Question label')
            .setRequired(true)
        )
        .addStringOption((opt: any) =>
          opt
            .setName('type')
            .setDescription('Question type')
            .setRequired(true)
            .addChoices(
              { name: 'Short Text', value: 'short_text' },
              { name: 'Long Text', value: 'long_text' },
              { name: 'Multiple Choice', value: 'multiple_choice' },
              { name: 'Checkbox', value: 'checkbox' },
              { name: 'Dropdown', value: 'dropdown' },
              { name: 'Number', value: 'number' },
              { name: 'Email', value: 'email' },
              { name: 'URL', value: 'url' }
            )
        )
        .addBooleanOption((opt: any) =>
          opt
            .setName('required')
            .setDescription('Is this question required?')
            .setRequired(true)
        )
    )
    .addSubcommand((sub: any) =>
      sub
        .setName('removequestion')
        .setDescription('Remove a question from the form')
        .addIntegerOption((opt: any) =>
          opt
            .setName('questionindex')
            .setDescription('Index of the question to remove (starts at 1)')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sub: any) =>
      sub
        .setName('viewquestions')
        .setDescription('View all questions in the form')
    )
    .addSubcommand((sub: any) =>
      sub
        .setName('updatemeta')
        .setDescription('Update form metadata')
        .addStringOption((opt: any) =>
          opt
            .setName('name')
            .setDescription('New form name')
            .setRequired(false)
        )
        .addStringOption((opt: any) =>
          opt
            .setName('description')
            .setDescription('New form description')
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  module: 'forms',
  permissionPath: 'forms.edit',
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const guildId = interaction.guildId!;
      if (!guildId) {
        await interaction.editReply({ content: '❌ This command can only be used in a server.' });
        return;
      }

      const formId = interaction.options.getString('formid', true);
      const subcommand = interaction.options.getSubcommand();

      const form = await getFormById(formId);
      if (!form || form.guildId !== guildId) {
        await interaction.editReply({ content: '❌ Form not found.' });
        return;
      }

      switch (subcommand) {
        case 'addquestion': {
          const label = interaction.options.getString('label', true);
          const type = interaction.options.getString('type', true) as FormQuestion['type'];
          const required = interaction.options.getBoolean('required', true);

          const newQuestion: FormQuestion = {
            label,
            type,
            required,
            placeholder: '',
            options: type === 'multiple_choice' || type === 'dropdown' ? [] : undefined,
          };

          form.questions.push(newQuestion);
          await updateForm(formId, { questions: form.questions });

          await interaction.editReply({
            content: `✅ Question added to form **${form.name}**:\n**${label}** (${type}, ${required ? 'required' : 'optional'})`,
          });

          logger.info(`[Forms] Question added - Form: ${formId}, Label: ${label}`);
          break;
        }

        case 'removequestion': {
          const index = interaction.options.getInteger('questionindex', true) - 1;

          if (index < 0 || index >= form.questions.length) {
            await interaction.editReply({ content: `❌ Question index out of range. Form has ${form.questions.length} question(s).` });
            return;
          }

          const removed = form.questions.splice(index, 1)[0];
          await updateForm(formId, { questions: form.questions });

          await interaction.editReply({
            content: `✅ Question removed from form **${form.name}**:\n**${removed.label}** (${removed.type})`,
          });

          logger.info(`[Forms] Question removed - Form: ${formId}, Label: ${removed.label}`);
          break;
        }

        case 'viewquestions': {
          if (form.questions.length === 0) {
            await interaction.editReply({ content: `❌ Form **${form.name}** has no questions yet.` });
            return;
          }

          const container = moduleContainer('forms');
          const description = form.questions
            .map(
              (q, i) =>
                `**${i + 1}. ${q.label}**\n` +
                `Type: ${q.type}\n` +
                `Required: ${q.required ? 'Yes' : 'No'}\n` +
                (q.options ? `Options: ${q.options.join(', ')}\n` : '')
            )
            .join('\n');

          addText(container, `### ${form.name} - Questions\n${description}`);

          await interaction.editReply(v2Payload([container]));
          break;
        }

        case 'updatemeta': {
          const newName = interaction.options.getString('name');
          const newDescription = interaction.options.getString('description');

          const updates: Partial<typeof form> = {};
          if (newName) updates.name = newName;
          if (newDescription !== null) updates.description = newDescription || '';

          if (Object.keys(updates).length === 0) {
            await interaction.editReply({ content: '❌ Please provide at least one field to update.' });
            return;
          }

          await updateForm(formId, updates);

          await interaction.editReply({
            content: `✅ Form **${newName || form.name}** updated.`,
          });

          logger.info(`[Forms] Form metadata updated - Form: ${formId}`);
          break;
        }

        default:
          await interaction.editReply({ content: '❌ Unknown subcommand.' });
      }
    } catch (error) {
      logger.error('[Forms] /formedit error:', error);
      await interaction.editReply({ content: '❌ An error occurred while editing the form.' });
    }
  },
};

export default command;
