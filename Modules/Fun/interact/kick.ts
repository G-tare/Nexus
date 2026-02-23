import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('kick-fun')
    .setDescription('Kick someone (for fun)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to kick')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.kick',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);

      const embed = new EmbedBuilder()
        .setDescription(`${interaction.user.username} kicked ${targetUser.username}! 🦵`)
        .setImage(getRandomGif('kick'))
        .setColor('#FF4500');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Kick command error:', error);
      await interaction.reply({
        content: 'Failed to execute kick. Please try again later.',
        ephemeral: true
      });
    }
  }
} as BotCommand;
