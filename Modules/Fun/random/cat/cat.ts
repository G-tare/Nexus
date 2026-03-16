import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addText, addMediaGallery, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const catFallback = {
  image: 'https://cdn2.thecatapi.com/images/MTcyOTI2Mw.jpg',
  width: 640,
  height: 480
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('cat')
    .setDescription('Get a random cat image'),
  permissionPath: 'fun.random.cat',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      // TODO: Implement actual API fetch from thecatapi
      // const response = await fetch('https://api.thecatapi.com/v1/images/search', {
      //   headers: { 'x-api-key': process.env.CAT_API_KEY }
      // });
      // const data = await response.json();
      // const cat = data[0];

      const cat = catFallback;

      const container = moduleContainer('fun');
      addText(container, '### 🐱 Random Cat');
      addMediaGallery(container, [{ url: cat.image }]);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Cat command error:', error);
      await interaction.reply({
        content: 'Failed to fetch cat image. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
