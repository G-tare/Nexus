import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('Search YouTube')
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription('Search query')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.search.youtube',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const query = interaction.options.getString('query', true);
      const encodedQuery = encodeURIComponent(query);

      const container = moduleContainer('utilities');
      addText(container, `### 🎬 YouTube Search\n[Search results for "${query}"](https://www.youtube.com/results?search_query=${encodedQuery})`);
      addFields(container, [
        {
          name: 'Query',
          value: `\`${query}\``,
        },
        {
          name: 'Quick Access',
          value: `[Open in YouTube](https://www.youtube.com/results?search_query=${encodedQuery})`,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in youtube search command:', error);
      await interaction.editReply({
        content: 'An error occurred while performing the search.',
      });
    }
  },
};

export default command;
