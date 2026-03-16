import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('github')
    .setDescription('Search GitHub repositories')
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription('Repository search query')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.search.github',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const query = interaction.options.getString('query', true);

      // Fetch from GitHub API
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`
      );

      if (!response.ok) {
        throw new Error('GitHub API request failed');
      }

      const data = (await response.json()) as any;
      const repos = data.items || [];

      if (repos.length === 0) {
        await interaction.editReply(v2Payload([errorContainer('No Repositories Found', `No repositories found for "${query}"`)]));
        return;
      }

      const container = moduleContainer('utilities');
      addText(container, `### 🔍 GitHub Search Results\nTop results for "${query}"`);
      addText(container, `[Search on GitHub](https://github.com/search?q=${encodeURIComponent(query)}&type=repositories)`);
      addSeparator(container, 'small');

      const fields = repos.slice(0, 5).map((repo: any) => {
        const stars = repo.stargazers_count || 0;
        const lang = repo.language || 'N/A';
        return {
          name: `${repo.name}`,
          value: `**Author:** ${repo.owner.login}\n**Stars:** ⭐ ${stars}\n**Language:** ${lang}\n[View Repo](${repo.html_url})`,
          inline: false,
        };
      });
      addFields(container, fields);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in github search command:', error);
      await interaction.editReply({
        content: 'An error occurred while performing the search.',
      });
    }
  },
};

export default command;
