import {  SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('wave')
    .setDescription('Wave at someone')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to wave at')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.wave',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);

      const embed = new EmbedBuilder()
        .setDescription(`${interaction.user.username} waved at ${targetUser.username}! 👋`)
        .setImage(getRandomGif('wave'))
        .setColor('#00CED1');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Wave command error:', error);
      await interaction.reply({
        content: 'Failed to execute wave. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
