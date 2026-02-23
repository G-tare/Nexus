import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('cry')
    .setDescription('Cry')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to cry because of (optional)')
    ),
  permissionPath: 'fun.interact.cry',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');

      const description = targetUser
        ? `${interaction.user.username} is crying because of ${targetUser.username}! 😭`
        : `${interaction.user.username} is crying! 😭`;

      const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(getRandomGif('cry'))
        .setColor('#4169E1');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Cry command error:', error);
      await interaction.reply({
        content: 'Failed to execute cry. Please try again later.',
        ephemeral: true
      });
    }
  }
} as BotCommand;
