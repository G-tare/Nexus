import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Forms');
import { getActiveFormsByGuild } from '../helpers';

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

        const embed = new EmbedBuilder()
          .setTitle(form.name)
          .setDescription(form.description || 'No description provided')
          .setColor('#5865F2')
          .addFields({
            name: 'Form Link',
            value: formUrl,
            inline: false,
          })
          .setFooter({ text: `Form ID: ${form.id}` })
          .setTimestamp();

        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setLabel('Open Form').setStyle(ButtonStyle.Link).setURL(formUrl),
          new ButtonBuilder().setLabel('Copy Link').setStyle(ButtonStyle.Secondary).setCustomId('copy_form_link')
        );

        await interaction.editReply({
          embeds: [embed],
          components: [buttons],
        });
      } else {
        // Show all available forms
        const embed = new EmbedBuilder()
          .setTitle('Available Forms')
          .setColor('#5865F2')
          .setDescription(
            forms
              .map((f) => `**${f.name}**\n${f.description || 'No description'}\nID: \`${f.id}\``)
              .join('\n\n')
          )
          .setFooter({ text: `Use /form <form> to get the link to a specific form` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      logger.error('[Forms] /form error:', error);
      await interaction.editReply({ content: '❌ An error occurred while fetching forms.' });
    }
  },
};

export default command;
