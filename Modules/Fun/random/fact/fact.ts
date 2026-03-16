import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const facts = [
  'Honey never spoils and can last for thousands of years!',
  'A group of flamingos is called a "flamboyance".',
  'Octopuses have three hearts and blue blood.',
  'Bananas are berries, but strawberries are not.',
  'The Great Wall of China is not visible from space with the naked eye.',
  'A day on Venus is longer than its year.',
  'Cleopatra lived closer to the invention of the iPhone than to the building of the Great Pyramid.',
  'Honey is the only food that doesn\'t expire.',
  'Penguins propose to their mates with a pebble.',
  'The Eiffel Tower can be 15 cm taller in the summer due to thermal expansion.',
  'A group of crows is called a "murder".',
  'The shortest war in history lasted only 38 minutes.',
  'Wombats produce cube-shaped poop.',
  'A cockroach can live for a week without its head.',
  'Sharks are older than dinosaurs and trees.',
  'A group of pugs is called a "grumble".',
  'The smell of petrichor (rain on dry earth) comes from an oil released by plants.',
  'Butterflies taste with their feet.',
  'A group of owls is called a "parliament".',
  'The fingerprints of koalas are nearly identical to human fingerprints.',
  'Otters hold hands when they sleep so they don\'t drift apart.',
  'The mantis shrimp can see colors we can\'t even imagine.',
  'A group of sheep is called a "fluffle".',
  'Scotland\'s national animal is a unicorn.',
  'The smallest country in the world is Vatican City at 0.17 square miles.',
  'Polar bears are left-handed.',
  'Sloths can hold their breath longer than dolphins.',
  'A group of badgers is called a "cete".',
  'The Arctic Tern has the longest migration of any animal.',
  'Hummingbirds can fly backwards and are the only birds that can.'
];

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('fact')
    .setDescription('Get a random fun fact'),
  permissionPath: 'fun.random.fact',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      // TODO: Implement actual API fetch from fun facts API
      // const response = await fetch('https://uselessfacts.jsonsrv.com/random');
      // const data = await response.json();

      const fact = facts[Math.floor(Math.random() * facts.length)];

      const container = moduleContainer('fun');
      addText(container, '### 💡 Random Fun Fact');
      addText(container, fact);
      addFooter(container, 'Did you know?');

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Fact command error:', error);
      await interaction.reply({
        content: 'Failed to fetch fact. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
