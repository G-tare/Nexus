import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Forms');
import { getActiveFormsByGuild } from '../helpers';
import { moduleContainer, addText, addFields, addButtons, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('form')
    .setDescription('View available forms and get the form link')
    .addStringOption((option) =>
      option
        .setName('form')
        .setDescription('Select a form to get the link')
        .setRequired(false)
        .setAutocomplete(true)
    ),
  module: 'forms',
  permissionPath: 'forms.form',
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const guildId = interaction.guildId!;
      if (!guildId) {
        await interaction.editReply({ content: '❌ This command can only be used in a server.' });
        return;
      }

      const selectedFormId = interaction.options.getString('form');

      const forms = await getActiveFormsByGuild(guildId);

      if (forms.length === 0) {
        await interaction.editReply({ content: '❌ No active forms available at this time.' });
        return;
      }

      if (selectedFormId) {
        const form = forms.find((f) => f.id === selectedFormId);
        if (!form) {
          await interaction.editReply({ content: '❌ Form not found or is not active.' });
          return;
        }

        const baseUrl = process.env.FORM_BASE_URL || 'https://your-bot-domain.com';
        const formUrl = `${baseUrl}/forms/${guildId}/${form.id}`;

        const container = moduleContainer('forms');
        addText(container, `### ${form.name}\n${form.description || 'No description provided'}`);
        addFields(container, [{
          name: 'Form Link',
          value: formUrl,
          inline: false,
        }]);

        const openBtn = new ButtonBuilder().setLabel('Open Form').setStyle(ButtonStyle.Link).setURL(formUrl);
        const copyBtn = new ButtonBuilder().setLabel('Copy Link').setStyle(ButtonStyle.Secondary).setCustomId('copy_form_link');

        addButtons(container, [openBtn, copyBtn]);

        await interaction.editReply(v2Payload([container]));
      } else {
        // Show all available forms
        const container = moduleContainer('forms');
        const description = forms
          .map((f) => `**${f.name}**\n${f.description || 'No description'}\nID: \`${f.id}\``)
          .join('\n\n');

        addText(container, `### Available Forms\n${description}\n\n-# Use /form <form> to get the link to a specific form`);

        await interaction.editReply(v2Payload([container]));
      }
    } catch (error) {
      logger.error('[Forms] /form error:', error);
      await interaction.editReply({ content: '❌ An error occurred while fetching forms.' });
    }
  },
};

export default command;
