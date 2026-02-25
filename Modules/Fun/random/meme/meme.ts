import {  SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';

const memeFallback = {
  title: 'Meme',
  image: 'https://via.placeholder.com/500x400?text=Placeholder+Meme',
  subreddit: 'r/memes'
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Get a random meme'),
  permissionPath: 'fun.random.meme',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      // TODO: Implement actual API fetch from reddit/meme API
      // const response = await fetch('https://meme-api.com/gimme');
      // const data = await response.json();

      const meme = memeFallback;

      const embed = new EmbedBuilder()
        .setTitle(meme.title)
        .setImage(meme.image)
        .setFooter({ text: meme.subreddit })
        .setColor('#FF6B6B');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Meme command error:', error);
      await interaction.reply({
        content: 'Failed to fetch meme. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
