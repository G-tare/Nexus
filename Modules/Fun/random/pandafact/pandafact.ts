import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../../Shared/src/utils/componentsV2';
import { getRandomElement } from '../../helpers';

const PANDA_FACTS = [
  'Giant pandas eat up to 26 pounds of bamboo daily.',
  'Despite being carnivores, pandas rarely eat meat.',
  'A panda\'s bite force is equal to a grizzly bear\'s.',
  'Pandas have a bamboo-eating schedule: 14 hours per day.',
  'Baby pandas are born pink and hairless.',
  'Pandas have a pseudo-thumb to help grip bamboo.',
  'Only about 1,000 pandas remain in the wild.',
  'Pandas communicate through bleating and chirping sounds.',
  'A panda\'s digestive system is inefficient at processing bamboo.',
  'Pandas were once hunted for their fur.',
  'The first panda to arrive in the US was Chi Chi in 1961.',
  'Pandas can live 20 years in captivity.',
  'Panda mating season is only 2-3 weeks per year.',
  'Pandas have an excellent sense of smell.',
  'A newborn panda weighs about 3-5 ounces.',
  'Pandas are excellent tree climbers as cubs.',
  'Giant pandas are a symbol of wildlife conservation.',
  'Pandas have 5 digits plus a pseudo-thumb.',
  'Pandas spend most of their time eating and resting.',
  'The panda\'s black and white coloring may serve as camouflage.',
  'Pandas have a white face and ears with black eyes.',
  'Only about 1,000 pandas are known to exist.',
  'Pandas are on the endangered species list.',
  'Panda cubs are completely dependent on their mothers.',
  'Pandas prefer dense bamboo forests.',
  'A panda\'s favorite food is arrow bamboo.',
  'Pandas have poor eyesight but excellent hearing.',
  'Panda mothers are very protective of their young.',
  'Pandas have 21 teeth including molars for grinding bamboo.',
  'A panda can eat different parts of bamboo seasonally.',
  'Pandas cannot digest bamboo properly like herbivores.',
  'The panda population has been increasing thanks to conservation.',
  'Pandas were thought to be extinct in the 1960s.',
  'Giant pandas are found only in central China.',
  'Pandas have a unique fingerprint pattern.',
  'A panda\'s metabolism is slower than most bears.',
  'Pandas spend 99% of their feeding time on bamboo.',
  'Panda cubs can climb trees within months of birth.',
  'Pandas make 11 different vocalizations.',
  'A wild panda travels up to 26 miles daily searching for food.',
  'Pandas need to eat bamboo from dawn to dusk.',
  'The giant panda was hunted to near extinction.',
  'Zoos around the world breed pandas in captivity programs.',
  'Pandas are curious and playful animals.',
  'A panda\'s eyespot patterns are unique like fingerprints.',
  'Pandas have strong arm muscles for climbing.',
  'The panda symbol was chosen for the WWF logo in 1961.',
  'Pandas have been around for millions of years.',
  'A panda\'s bamboo diet provides minimal nutrition.',
  'Pandas are surprisingly aggressive when threatened.',
];

export default {
  data: new SlashCommandBuilder()
    .setName('pandafact')
    .setDescription('Get a random panda fact'),

  module: 'fun',
  permissionPath: 'fun.random.pandafact',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const fact = getRandomElement(PANDA_FACTS);

      const container = moduleContainer('fun');
      addText(container, '### Panda Fact');
      addText(container, fact);
      addFooter(container, '🐼');

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Panda fact error:', error);
      await interaction.reply({
        content: 'Failed to get panda fact.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} as BotCommand;
