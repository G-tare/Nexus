import {  SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';

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

      const embed = new EmbedBuilder()
        .setTitle('🐕 Random Dog')
        .setImage(dog.image)
        .setFooter({ text: `Breed: ${dog.breed}` })
        .setColor('#8B4513');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Dog command error:', error);
      await interaction.reply({
        content: 'Failed to fetch dog image. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
