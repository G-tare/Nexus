import {  SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('laugh')
    .setDescription('Laugh at someone')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to laugh at')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.laugh',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);

      const embed = new EmbedBuilder()
        .setDescription(`${interaction.user.username} laughed at ${targetUser.username}! 😂`)
        .setImage(getRandomGif('laugh'))
        .setColor('#FFA500');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Laugh command error:', error);
      await interaction.reply({
        content: 'Failed to execute laugh. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
