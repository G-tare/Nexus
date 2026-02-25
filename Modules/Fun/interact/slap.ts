import {  SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('slap')
    .setDescription('Slap someone')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to slap')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.slap',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);

      const embed = new EmbedBuilder()
        .setDescription(`${interaction.user.username} slapped ${targetUser.username}! 👋`)
        .setImage(getRandomGif('slap'))
        .setColor('#FF6B6B');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Slap command error:', error);
      await interaction.reply({
        content: 'Failed to execute slap. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
