import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, v2Payload, successContainer, errorContainer } from '../../../Shared/src/utils/componentsV2';
import { addNote } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('notepad-add')
    .setDescription('Add a new note to your personal notepad')
    .addStringOption((opt) =>
      opt
        .setName('title')
        .setDescription('Note title')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('content')
        .setDescription('Note content')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.notepad.add',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const title = interaction.options.getString('title', true);
      const content = interaction.options.getString('content', true);

      const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'utilities');
      const config = (_cfgResult?.config ?? {}) as Record<string, any>;
      const maxNotes = config.maxNotes || 25;

      const result = await addNote(guildId, userId, title, content, maxNotes);

      if (!result.success) {
        await interaction.editReply(v2Payload([errorContainer('Failed to Add Note', result.error || 'An error occurred')]));
        return;
      }

      const container = moduleContainer('utilities');
      addText(container, '### ✅ Note Added');
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'Title',
          value: title,
          inline: false,
        },
        {
          name: 'Content',
          value: content,
          inline: false,
        },
        {
          name: 'Note ID',
          value: `\`${result.note?.id}\``,
          inline: false,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in notepad add command:', error);
      await interaction.editReply({
        content: 'An error occurred while adding the note.',
      });
    }
  },
};

export default command;
