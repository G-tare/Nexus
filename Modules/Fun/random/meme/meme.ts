import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addText, addMediaGallery, addFooter, v2Payload } from '../../../../Shared/src/utils/componentsV2';

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

      const container = moduleContainer('fun');
      addText(container, `### ${meme.title}`);
      addMediaGallery(container, [{ url: meme.image }]);
      addFooter(container, meme.subreddit);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Meme command error:', error);
      await interaction.reply({
        content: 'Failed to fetch meme. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
