import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const roasts = [
  'You\'re proof that evolution can go in reverse.',
  'I would insult you, but it would be a waste of energy.',
  'You bring everyone so much joy when you leave the room.',
  'I\'ve seen people like you before, but I had to pay admission.',
  'Your intelligence is my common sense.',
  'You\'re like a cloud. When you disappear, it\'s a beautiful day.',
  'You make everyone around you feel like a genius.',
  'I\'ll remember you as a true friend.',
  'Your secrets are always safe with me, I simply forget them.',
  'I don\'t know what makes you tick, but I hope it\'s a time bomb.',
  'You\'re like a fire extinguisher - mostly just red and useless.',
  'Mirrors can\'t talk. Lucky for you they can\'t laugh either.',
  'I would follow you anywhere, out of morbid curiosity.',
  'You\'ve got a lot of nerve. Not much else, but a lot of nerve.',
  'Do you have any idea how stupidly you look?',
  'I\'d smack you, but I don\'t want your stupidity all over my hands.',
  'You\'re the reason the gene pool needs a lifeguard.',
  'You\'re like the human equivalent of a participation trophy.',
  'Being around you is like a Crayola box - you\'ve got all the bright colors on the outside, but you\'re still just a box of wax.',
  'You\'re so dumb, you\'d need a map to find your way out of a parking lot.',
  'I could agree with you, but then we\'d both be wrong.',
  'You\'re the only person who can make a bad situation worse.',
  'I\'d like to see things from your perspective, but I can\'t get my head that far up my butt.',
  'You\'re proof that not all of God\'s creatures are intelligent.',
  'You\'re so dumb, the internet has to dial down just to work for you.',
  'You\'re like a dictionary - you add no value, but you\'re occasionally useful.',
  'If you were a vegetable, you\'d be a turnip - dull and easily forgotten.',
  'You\'re the human equivalent of a participation medal.',
  'I\'m not saying you\'re slow, but you\'d need a map to find your way out of a paper bag.',
  'You\'re the reason they invented the term "dumb luck".'
];

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('roast')
    .setDescription('Get a funny roast')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to roast (optional)')
    ),
  permissionPath: 'fun.random.roast',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');
      const roast = roasts[Math.floor(Math.random() * roasts.length)];

      const target = targetUser ? `${targetUser.username}` : 'you';
      const message = `${target}: ${roast}`;

      const container = moduleContainer('fun');
      addText(container, '### 🔥 Roast');
      addText(container, message);
      addFooter(container, 'It\'s all in good fun!');

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Roast command error:', error);
      await interaction.reply({
        content: 'Failed to generate roast. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
