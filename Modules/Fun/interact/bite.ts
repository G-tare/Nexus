import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('bite')
    .setDescription('Bite someone')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to bite')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.bite',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);

      const embed = new EmbedBuilder()
        .setDescription(`${interaction.user.username} bit ${targetUser.username}! 😲`)
        .setImage(getRandomGif('bite'))
        .setColor('#8B4513');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Bite command error:', error);
      await interaction.reply({
        content: 'Failed to execute bite. Please try again later.',
        ephemeral: true
      });
    }
  }
} as BotCommand;
