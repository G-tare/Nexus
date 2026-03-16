import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, addFooter, v2Payload, infoContainer } from '../../../Shared/src/utils/componentsV2';
import { getNotes } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('notepad-view')
    .setDescription('View your notes')
    .addStringOption((opt) =>
      opt
        .setName('id')
        .setDescription('View a specific note by ID (optional)')
        .setRequired(false)
    ),

  module: 'utilities',
  permissionPath: 'utilities.notepad.view',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const noteId = interaction.options.getString('id');

      const notes = await getNotes(guildId, userId);

      if (notes.length === 0) {
        await interaction.editReply(v2Payload([infoContainer('📝 Your Notes', 'You have no notes yet. Use `/notepad-add` to create one!')]));
        return;
      }

      if (noteId) {
        const note = notes.find(n => n.id === noteId);

        if (!note) {
          await interaction.editReply({
            content: `❌ Note with ID \`${noteId}\` not found.`,
          });
          return;
        }

        const container = moduleContainer('utilities');
        addText(container, `### ${note.title}\n${note.content}`);
        addFooter(container, `ID: ${note.id} • Created: ${new Date(note.createdAt).toLocaleString()}`);

        await interaction.editReply(v2Payload([container]));
        return;
      }

      // View all notes
      const container = moduleContainer('utilities');
      addText(container, `### 📝 Your Notes\nYou have **${notes.length}** note(s)`);
      addSeparator(container, 'small');

      const fields = notes.slice(0, 10).map(note => {
        const preview = note.content.length > 100 ? note.content.substring(0, 100) + '...' : note.content;
        return {
          name: `${note.title} (ID: ${note.id})`,
          value: preview,
          inline: false,
        };
      });
      addFields(container, fields);

      if (notes.length > 10) {
        addFooter(container, `Showing 10 of ${notes.length} notes`);
      }

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in notepad view command:', error);
      await interaction.editReply({
        content: 'An error occurred while viewing your notes.',
      });
    }
  },
};

export default command;
