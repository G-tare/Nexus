import {  SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('kiss')
    .setDescription('Kiss someone')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to kiss')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.kiss',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);

      const embed = new EmbedBuilder()
        .setDescription(`${interaction.user.username} kissed ${targetUser.username}! 😘`)
        .setImage(getRandomGif('kiss'))
        .setColor('#FF1493');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Kiss command error:', error);
      await interaction.reply({
        content: 'Failed to execute kiss. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
