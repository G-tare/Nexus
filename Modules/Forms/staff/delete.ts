import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Forms');
import { getFormById, deleteForm } from '../helpers';

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
        await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
        return;
      }

      const formId = interaction.options.getString('formid', true);

      const form = await getFormById(formId);
      if (!form || form.guildId !== guildId) {
        await interaction.reply({ content: '❌ Form not found.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('⚠️ Confirm Form Deletion')
        .setColor('#FF0000')
        .setDescription(`Are you sure you want to delete the form **${form.name}**?\n\nThis action will delete the form and all ${form.responseChannelId ? '(unknown number of)' : '0'} associated responses and cannot be undone.`)
        .setTimestamp();

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_delete_form_${formId}`)
          .setLabel('Confirm Delete')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_form_delete')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        embeds: [embed],
        components: [buttons],
        ephemeral: false,
      });
    } catch (error) {
      logger.error('[Forms] /formdelete error:', error);
      await interaction.reply({ content: '❌ An error occurred while deleting the form.', ephemeral: true });
    }
  },
};

export default command;
