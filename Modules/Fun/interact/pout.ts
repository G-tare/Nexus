import {  SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('pout')
    .setDescription('Pout')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who you\'re pouting at (optional)')
    ),
  permissionPath: 'fun.interact.pout',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');

      const description = targetUser
        ? `${interaction.user.username} is pouting at ${targetUser.username}! 😠`
        : `${interaction.user.username} is pouting! 😠`;

      const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(getRandomGif('pout'))
        .setColor('#FF69B4');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Pout command error:', error);
      await interaction.reply({
        content: 'Failed to execute pout. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
