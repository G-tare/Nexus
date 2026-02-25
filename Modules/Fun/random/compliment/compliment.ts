import {  SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';

const compliments = [
  'You\'re the most thoughtful person I know.',
  'Your sense of humor is absolutely hilarious.',
  'You light up the room when you walk in.',
  'You bring out the best in people around you.',
  'You\'re a great listener.',
  'You have impeccable manners.',
  'You\'re incredibly creative and talented.',
  'You\'re a true asset to your team.',
  'You\'ve got excellent taste.',
  'Your ideas are always interesting and unique.',
  'You\'re always making people laugh.',
  'You\'re so kind and thoughtful.',
  'Your enthusiasm is infectious.',
  'You\'re a great friend.',
  'You\'re incredibly intelligent.',
  'You\'re absolutely amazing.',
  'You have the best laugh.',
  'You\'re super fun to be around.',
  'Your smile is absolutely gorgeous.',
  'You\'re really good at what you do.',
  'You\'re someone I truly admire.',
  'You\'ve got great potential.',
  'You\'re one of the good ones.',
  'You\'re an excellent communicator.',
  'You\'re inspiring and motivational.'
];

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('compliment')
    .setDescription('Get a random compliment')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to compliment (optional)')
    ),
  permissionPath: 'fun.random.compliment',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');
      const compliment = compliments[Math.floor(Math.random() * compliments.length)];

      const target = targetUser ? `${targetUser.username}` : interaction.user.username;
      const message = `${target}, ${compliment}`;

      const embed = new EmbedBuilder()
        .setTitle('💚 Compliment')
        .setDescription(message)
        .setColor('#FFB6C1')
        .setFooter({ text: 'Spread positivity!' });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Compliment command error:', error);
      await interaction.reply({
        content: 'Failed to generate compliment. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
