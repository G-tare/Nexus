import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../../Shared/src/utils/componentsV2';
import { getRandomElement } from '../../helpers';

const BIRD_FACTS = [
  'A hummingbird\'s heart beats up to 1,260 times per minute.',
  'Penguins have knees, but you can\'t see them because they\'re hidden by feathers.',
  'Owls can turn their heads up to 270 degrees.',
  'Parrots can live as long as humans, up to 80 years.',
  'Some birds sleep with only half of their brain at a time.',
  'Eagles can see prey from 2 miles away.',
  'Flamingos are pink because of their diet of algae and shrimp.',
  'A woodpecker\'s skull is adapted to withstand impacts of up to 1,000 Gs.',
  'Crows can recognize human faces and hold grudges.',
  'Swifts can spend up to 10 months in the air without landing.',
  'The Arctic Tern has the longest migration of any animal on Earth.',
  'Peacocks have over 200 feathers in their tails.',
  'Pigeons can navigate using the Earth\'s magnetic field.',
  'Ostriches can run at speeds of 45 mph.',
  'A swan\'s song is the basis for several classical music compositions.',
  'Albatrosses can fly for hours without flapping their wings.',
  'Chickens have over 30 different vocal sounds.',
  'Ravens can solve complex problems and use tools.',
  'Hummingbirds are the only birds that can fly backwards.',
  'A rooster\'s crow can be heard from up to 5 miles away.',
  'Storks can fly up to 30,000 feet high.',
  'Penguins can dive up to 1,800 feet deep.',
  'Nightingales can sing up to 1,000 different songs.',
  'Cranes can fly up to 30,000 feet and migrate thousands of miles.',
  'Woodpeckers peck up to 20 times per second.',
  'Geese have a hierarchical social structure.',
  'Puffins are excellent swimmers and can dive over 100 feet.',
  'Terns can see fish in the water while flying above it.',
  'Kiwi birds are nocturnal and have poor eyesight.',
  'A pelican\'s pouch can hold up to 3 gallons of water.',
  'Finches inspired Darwin\'s theory of evolution.',
  'Secretary birds stomp on snakes with their powerful legs.',
  'Cassowaries are one of the most dangerous birds.',
  'Colibris (hummingbirds) don\'t have a sense of smell.',
  'Mockingbirds can mimic over 200 different sounds.',
  'Vultures can see a dead animal from miles away.',
  'Buzzards can fly for hours without flapping.',
  'Kingfishers have special eyes adapted for underwater vision.',
  'Owls have ear tufts but not for hearing.',
  'Hawks have eight times better vision than humans.',
  'Cormorants can dive deeper than most diving birds.',
  'Herons can spear fish with their sharp beaks.',
  'Swallows can fly while sleeping.',
  'Chickadees can remember where they hid thousands of seeds.',
  'Magpies are one of the few animals that recognize themselves in a mirror.',
  'Roadrunners can reach speeds of 26 mph.',
  'Larks sing continuously for hours during breeding season.',
  'Falcons are the fastest animals on Earth, diving at 240 mph.',
  'Doves symbolize peace in many cultures.',
  'Sparrows can have up to 3 broods per year.',
  'Warblers migrate thousands of miles annually.',
];

export default {
  data: new SlashCommandBuilder()
    .setName('birdfact')
    .setDescription('Get a random bird fact'),

  module: 'fun',
  permissionPath: 'fun.random.birdfact',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const fact = getRandomElement(BIRD_FACTS);

      const container = moduleContainer('fun');
      addText(container, '### Bird Fact');
      addText(container, fact);
      addFooter(container, '🐦');

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Bird fact error:', error);
      await interaction.reply({
        content: 'Failed to get bird fact.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} as BotCommand;
