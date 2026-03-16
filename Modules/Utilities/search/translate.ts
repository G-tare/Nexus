import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('util-translate')
    .setDescription('Translate text to another language')
    .addStringOption((opt) =>
      opt
        .setName('text')
        .setDescription('Text to translate')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('language')
        .setDescription('Target language (e.g., es, fr, de, ja)')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.search.translate',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const text = interaction.options.getString('text', true);
      const language = interaction.options.getString('language', true).toLowerCase();

      // Fetch from MyMemory API
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(language)}`
      );

      if (!response.ok) {
        throw new Error('Translation API request failed');
      }

      const data = (await response.json()) as any;

      if (!data.responseData || data.responseStatus !== 200) {
        await interaction.editReply(v2Payload([errorContainer('Translation Failed', `Could not translate to language "${language}"`)]));
        return;
      }

      const translated = data.responseData.translatedText;

      const container = moduleContainer('utilities');
      addText(container, '### 🌐 Translation');
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'English',
          value: text,
          inline: false,
        },
        {
          name: language.toUpperCase(),
          value: translated,
          inline: false,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in translate command:', error);
      await interaction.editReply({
        content: 'An error occurred while translating the text.',
      });
    }
  },
};

export default command;
