import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const quotes = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Innovation distinguishes between a leader and a follower.', author: 'Steve Jobs' },
  { text: 'Life is what happens when you\'re busy making other plans.', author: 'John Lennon' },
  { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
  { text: 'It is during our darkest moments that we must focus to see the light.', author: 'Aristotle' },
  { text: 'The only impossible journey is the one you never begin.', author: 'Tony Robbins' },
  { text: 'In the end, we will remember not the words of our enemies, but the silence of our friends.', author: 'Martin Luther King Jr.' },
  { text: 'It is never too late to be what you might have been.', author: 'George Eliot' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { text: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'Everything you want is on the other side of fear.', author: 'Jack Canfield' },
  { text: 'Success is not final, failure is not fatal.', author: 'Winston Churchill' },
  { text: 'Your time is limited, don\'t waste it living someone else\'s life.', author: 'Steve Jobs' },
  { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
  { text: 'Don\'t watch the clock; do what it does. Keep going.', author: 'Sam Levenson' },
  { text: 'Whether you think you can, or you think you can\'t, you\'re right.', author: 'Henry Ford' },
  { text: 'I have learned over the years that when one\'s mind is made up, this diminishes fear.', author: 'Rosa Parks' },
  { text: 'Be yourself; everyone else is already taken.', author: 'Oscar Wilde' },
  { text: 'The only person you are destined to become is the person you decide to be.', author: 'Ralph Waldo Emerson' }
];

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('quote')
    .setDescription('Get a random inspirational quote'),
  permissionPath: 'fun.random.quote',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      // TODO: Implement actual API fetch from quotes API
      // const response = await fetch('https://api.quotable.io/random');
      // const data = await response.json();

      const quote = quotes[Math.floor(Math.random() * quotes.length)];

      const container = moduleContainer('fun');
      addText(container, '### ✨ Inspirational Quote');
      addText(container, `"${quote.text}"`);
      addFooter(container, `— ${quote.author}`);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Quote command error:', error);
      await interaction.reply({
        content: 'Failed to fetch quote. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
