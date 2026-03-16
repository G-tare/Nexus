import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addMediaGallery, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('enlarge')
    .setDescription('Show a custom emoji at full size')
    .addStringOption((opt) =>
      opt
        .setName('emoji')
        .setDescription('Custom emoji to enlarge')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.tools.enlarge',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const emojiInput = interaction.options.getString('emoji', true);

      // Extract custom emoji ID from format <:name:id> or <a:name:id>
      const match = emojiInput.match(/<a?:[\w]+:(\d+)>/);

      if (!match || !match[1]) {
        await interaction.editReply({
          content: '❌ Please provide a valid custom emoji (from this server or with proper format)',
        });
        return;
      }

      const emojiId = match[1];
      const isAnimated = emojiInput.startsWith('<a:');
      const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}?size=256`;

      const container = moduleContainer('utilities');
      addText(container, '### 📏 Enlarged Emoji');
      addMediaGallery(container, [{ url: emojiUrl }]);
      addFooter(container, `Emoji ID: ${emojiId}`);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in enlarge command:', error);
      await interaction.editReply({
        content: 'An error occurred while enlarging the emoji.',
      });
    }
  },
};

export default command;
