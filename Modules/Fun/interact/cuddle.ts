import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('cuddle')
    .setDescription('Cuddle someone')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to cuddle')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.cuddle',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);

      const embed = new EmbedBuilder()
        .setDescription(`${interaction.user.username} cuddled ${targetUser.username}! 🤗`)
        .setImage(getRandomGif('cuddle'))
        .setColor('#FF69B4');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Cuddle command error:', error);
      await interaction.reply({
        content: 'Failed to execute cuddle. Please try again later.',
        ephemeral: true
      });
    }
  }
} as BotCommand;
