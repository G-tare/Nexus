import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, v2Payload, successContainer, errorContainer } from '../../../Shared/src/utils/componentsV2';
import { updateNote } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('notepad-edit')
    .setDescription('Edit an existing note')
    .addStringOption((opt) =>
      opt
        .setName('id')
        .setDescription('Note ID to edit')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('content')
        .setDescription('New content for the note')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.notepad.edit',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const noteId = interaction.options.getString('id', true);
      const newContent = interaction.options.getString('content', true);

      const result = await updateNote(guildId, userId, noteId, newContent);

      if (!result.success) {
        await interaction.editReply(v2Payload([errorContainer('Failed to Edit Note', result.error || 'An error occurred')]));
        return;
      }

      const container = moduleContainer('utilities');
      addText(container, '### ✅ Note Updated');
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'Note ID',
          value: `\`${result.note?.id}\``,
          inline: true,
        },
        {
          name: 'Title',
          value: result.note?.title || 'Unknown',
          inline: true,
        },
        {
          name: 'New Content',
          value: newContent,
          inline: false,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in notepad edit command:', error);
      await interaction.editReply({
        content: 'An error occurred while editing the note.',
      });
    }
  },
};

export default command;
