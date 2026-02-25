import {  SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('boop')
    .setDescription('Boop someone')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to boop')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.boop',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);

      const embed = new EmbedBuilder()
        .setDescription(`${interaction.user.username} booped ${targetUser.username}! 👃`)
        .setImage(getRandomGif('boop'))
        .setColor('#FFB6C1');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Boop command error:', error);
      await interaction.reply({
        content: 'Failed to execute boop. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
