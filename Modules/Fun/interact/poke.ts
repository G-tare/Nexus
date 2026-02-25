import {  SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('poke')
    .setDescription('Poke someone')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to poke')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.poke',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);

      const embed = new EmbedBuilder()
        .setDescription(`${interaction.user.username} poked ${targetUser.username}! 👉`)
        .setImage(getRandomGif('poke'))
        .setColor('#9370DB');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Poke command error:', error);
      await interaction.reply({
        content: 'Failed to execute poke. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
