import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Forms');
import { getFormById, getFormResponses, updateResponseStatus } from '../helpers';
import { emitFormApproved, emitFormDenied } from '../events';
import { moduleContainer, addText, addButtons, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('formreview')
    .setDescription('Review and manage form submissions')
    .addStringOption((option) =>
      option
        .setName('formid')
        .setDescription('The ID of the form')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('status')
        .setDescription('Filter responses by status')
        .setRequired(false)
        .addChoices(
          { name: 'Pending', value: 'pending' },
          { name: 'Approved', value: 'approved' },
          { name: 'Denied', value: 'denied' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  module: 'forms',
  permissionPath: 'forms.review',
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const guildId = interaction.guildId!;
      if (!guildId) {
        await interaction.editReply({ content: '❌ This command can only be used in a server.' });
        return;
      }

      const formId = interaction.options.getString('formid', true);
      const statusFilter = interaction.options.getString('status');

      const form = await getFormById(formId);
      if (!form || form.guildId !== guildId) {
        await interaction.editReply({ content: '❌ Form not found.' });
        return;
      }

      const { responses, total } = await getFormResponses(formId, 10, 0);

      // Filter by status if specified
      const filteredResponses = statusFilter
        ? responses.filter((r) => r.status === statusFilter)
        : responses;

      if (filteredResponses.length === 0) {
        await interaction.editReply({
          content: `❌ No responses found for form: **${form.name}**${statusFilter ? ` with status: ${statusFilter}` : ''}`,
        });
        return;
      }

      const container = moduleContainer('forms');
      const description = filteredResponses
        .map(
          (r) =>
            `**Response ID**: ${r.id}\n` +
            `**User**: <@${r.userId}>\n` +
            `**Status**: ${r.status}\n` +
            `**Submitted**: <t:${Math.floor(r.submittedAt.getTime() / 1000)}:f>`
        )
        .join('\n\n');

      addText(container, `### ${form.name} - Review Submissions\n${description}\n\n-# Showing ${filteredResponses.length} of ${total} responses`);

      const pendingBtn = new ButtonBuilder()
        .setCustomId(`review_pending_${formId}`)
        .setLabel('View Pending')
        .setStyle(ButtonStyle.Primary);

      const approvedBtn = new ButtonBuilder()
        .setCustomId(`review_approved_${formId}`)
        .setLabel('View Approved')
        .setStyle(ButtonStyle.Success);

      const deniedBtn = new ButtonBuilder()
        .setCustomId(`review_denied_${formId}`)
        .setLabel('View Denied')
        .setStyle(ButtonStyle.Danger);

      addButtons(container, [pendingBtn, approvedBtn, deniedBtn]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error('[Forms] /formreview error:', error);
      await interaction.editReply({ content: '❌ An error occurred while reviewing responses.' });
    }
  },
};

export default command;
