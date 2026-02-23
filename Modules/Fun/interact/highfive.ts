import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('highfive')
    .setDescription('Give someone a high five')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to high five')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.highfive',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);

      const embed = new EmbedBuilder()
        .setDescription(`${interaction.user.username} high-fived ${targetUser.username}! 🙌`)
        .setImage(getRandomGif('highfive'))
        .setColor('#FFD700');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Highfive command error:', error);
      await interaction.reply({
        content: 'Failed to execute high five. Please try again later.',
        ephemeral: true
      });
    }
  }
} as BotCommand;
