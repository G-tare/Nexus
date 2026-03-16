import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('google')
    .setDescription('Search Google')
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription('Search query')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.search.google',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const query = interaction.options.getString('query', true);
      const encodedQuery = encodeURIComponent(query);

      const container = moduleContainer('utilities');
      addText(container, `### 🔍 Google Search\n[Search results for "${query}"](https://www.google.com/search?q=${encodedQuery})`);
      addFields(container, [
        {
          name: 'Query',
          value: `\`${query}\``,
        },
        {
          name: 'Quick Access',
          value: `[Open in Google](https://www.google.com/search?q=${encodedQuery})`,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in google search command:', error);
      await interaction.editReply({
        content: 'An error occurred while performing the search.',
      });
    }
  },
};

export default command;
