import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('npm')
    .setDescription('Search NPM packages')
    .addStringOption((opt) =>
      opt
        .setName('package')
        .setDescription('Package name')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.search.npm',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const packageName = interaction.options.getString('package', true);

      // Fetch from NPM registry
      const response = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(packageName)}`
      );

      if (!response.ok) {
        await interaction.editReply(v2Payload([errorContainer('Package Not Found', `Package "${packageName}" not found on NPM`)]));
        return;
      }

      const data = (await response.json()) as any;
      const latest = data['dist-tags']?.latest || 'unknown';
      const description = data.description || 'No description';
      const homepage = data.homepage || null;
      const repository = data.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '') || null;
      const author = data.author?.name || 'Unknown';

      const container = moduleContainer('utilities');
      addText(container, `### 📦 ${data.name}\n${description}`);
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'Latest Version',
          value: `\`${latest}\``,
          inline: true,
        },
        {
          name: 'Author',
          value: author,
          inline: true,
        },
        {
          name: 'Links',
          value: `${homepage ? `[Homepage](${homepage})` : ''} ${repository ? `[Repository](${repository})` : ''} [NPM](https://www.npmjs.com/package/${encodeURIComponent(packageName)})`.trim(),
          inline: false,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in npm search command:', error);
      await interaction.editReply({
        content: 'An error occurred while searching NPM.',
      });
    }
  },
};

export default command;
