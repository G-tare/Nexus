import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addText, addMediaGallery, addFooter, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const dogFallback = {
  image: 'https://images.dog.ceo/breeds/retriever-golden/n02099601_11136.jpg',
  breed: 'Golden Retriever'
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('dog')
    .setDescription('Get a random dog image'),
  permissionPath: 'fun.random.dog',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      // TODO: Implement actual API fetch from dog.ceo API
      // const response = await fetch('https://dog.ceo/api/breeds/image/random');
      // const data = await response.json();
      // const image = data.message;
      // const breed = image.split('/')[4];

      const dog = dogFallback;

      const container = moduleContainer('fun');
      addText(container, '### 🐕 Random Dog');
      addMediaGallery(container, [{ url: dog.image }]);
      addFooter(container, `Breed: ${dog.breed}`);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Dog command error:', error);
      await interaction.reply({
        content: 'Failed to fetch dog image. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
