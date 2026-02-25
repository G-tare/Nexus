import {  SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('dance')
    .setDescription('Dance')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to dance with (optional)')
    ),
  permissionPath: 'fun.interact.dance',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');

      const description = targetUser
        ? `${interaction.user.username} is dancing with ${targetUser.username}! 💃`
        : `${interaction.user.username} is dancing! 💃`;

      const embed = new EmbedBuilder()
        .setDescription(description)
        .setImage(getRandomGif('dance'))
        .setColor('#FF1493');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Dance command error:', error);
      await interaction.reply({
        content: 'Failed to execute dance. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
