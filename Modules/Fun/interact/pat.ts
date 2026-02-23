import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('pat')
    .setDescription('Pat someone')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to pat')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.pat',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);

      const embed = new EmbedBuilder()
        .setDescription(`${interaction.user.username} patted ${targetUser.username}! 👋`)
        .setImage(getRandomGif('pat'))
        .setColor('#87CEEB');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Pat command error:', error);
      await interaction.reply({
        content: 'Failed to execute pat. Please try again later.',
        ephemeral: true
      });
    }
  }
} as BotCommand;
