import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { findAnagrams } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('anagram')
    .setDescription('Find anagrams of a word')
    .addStringOption((opt) =>
      opt
        .setName('word')
        .setDescription('Word to find anagrams for')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.tools.anagram',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const word = interaction.options.getString('word', true);

      const anagrams = findAnagrams(word);

      const container = moduleContainer('utilities');
      addText(container, '### 🔤 Anagram Finder');
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'Input Word',
          value: `\`${word}\``,
          inline: false,
        },
        {
          name: 'Anagrams Found',
          value: anagrams.length > 0 ? anagrams.map(a => `\`${a}\``).join(', ') : 'No anagrams found',
          inline: false,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in anagram command:', error);
      await interaction.editReply({
        content: 'An error occurred while finding anagrams.',
      });
    }
  },
};

export default command;
