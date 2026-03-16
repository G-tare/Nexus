import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Forms');
import { getFormById, getFormResponses } from '../helpers';
import { moduleContainer, addText, addButtons, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('formresponses')
    .setDescription('View responses to a form')
    .addStringOption((option) =>
      option
        .setName('formid')
        .setDescription('The ID of the form')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('page')
        .setDescription('Page number (default: 1)')
        .setRequired(false)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  module: 'forms',
  permissionPath: 'forms.formresponses',
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const guildId = interaction.guildId!;
      if (!guildId) {
        await interaction.editReply({ content: '❌ This command can only be used in a server.' });
        return;
      }

      const formId = interaction.options.getString('formid', true);
      const page = interaction.options.getInteger('page') || 1;

      const form = await getFormById(formId);
      if (!form || form.guildId !== guildId) {
        await interaction.editReply({ content: '❌ Form not found.' });
        return;
      }

      const limit = 5;
      const offset = (page - 1) * limit;

      const { responses, total } = await getFormResponses(formId);

      if (total === 0) {
        await interaction.editReply({ content: `❌ No responses for form: **${form.name}**` });
        return;
      }

      const totalPages = Math.ceil(total / limit);

      const container = moduleContainer('forms');
      const description = responses
        .map(
          (r, index) =>
            `**Response ${offset + index + 1}**\n` +
            `User: <@${r.userId}>\n` +
            `Status: ${r.status}\n` +
            `Submitted: <t:${Math.floor(r.submittedAt.getTime() / 1000)}:f>\n` +
            `Answers: ${JSON.stringify(r.answers, null, 2).substring(0, 200)}...`
        )
        .join('\n\n');

      addText(container, `### ${form.name} - Responses\n${description}\n\n-# Page ${page}/${totalPages} - Total responses: ${total}`);

      const buttonList: ButtonBuilder[] = [];

      if (page > 1) {
        buttonList.push(
          new ButtonBuilder()
            .setCustomId(`formresponses_${formId}_${page - 1}`)
            .setLabel('← Previous')
            .setStyle(ButtonStyle.Primary)
        );
      }

      if (page < totalPages) {
        buttonList.push(
          new ButtonBuilder()
            .setCustomId(`formresponses_${formId}_${page + 1}`)
            .setLabel('Next →')
            .setStyle(ButtonStyle.Primary)
        );
      }

      if (buttonList.length > 0) {
        addButtons(container, buttonList);
      }

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error('[Forms] /formresponses error:', error);
      await interaction.editReply({ content: '❌ An error occurred while fetching responses.' });
    }
  },
};

export default command;
