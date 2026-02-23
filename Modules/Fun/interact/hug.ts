import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

// TODO: Implement getRandomGif helper
const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('hug')
    .setDescription('Give someone a hug')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to hug')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.hug',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);

      const embed = new EmbedBuilder()
        .setDescription(`${interaction.user.username} hugged ${targetUser.username}! 🤗`)
        .setImage(getRandomGif('hug'))
        .setColor('#FF69B4');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Hug command error:', error);
      await interaction.reply({
        content: 'Failed to execute hug. Please try again later.',
        ephemeral: true
      });
    }
  }
} as BotCommand;
