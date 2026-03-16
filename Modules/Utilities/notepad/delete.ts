import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successContainer, errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { deleteNote } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('notepad-delete')
    .setDescription('Delete a note')
    .addStringOption((opt) =>
      opt
        .setName('id')
        .setDescription('Note ID to delete')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.notepad.delete',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const noteId = interaction.options.getString('id', true);

      const result = await deleteNote(guildId, userId, noteId);

      if (!result.success) {
        await interaction.editReply(v2Payload([errorContainer('Failed to Delete Note', result.error || 'An error occurred')]));
        return;
      }

      await interaction.editReply(v2Payload([successContainer('Note Deleted', `Note with ID \`${noteId}\` has been deleted.`)]));
    } catch (error) {
      console.error('Error in notepad delete command:', error);
      await interaction.editReply({
        content: 'An error occurred while deleting the note.',
      });
    }
  },
};

export default command;
