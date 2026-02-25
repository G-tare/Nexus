import {  SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';

const getRandomGif = (action: string): string => {
  return 'https://media.giphy.com/media/placeholder.gif';
};

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('punch')
    .setDescription('Punch someone')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to punch')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.punch',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);

      const embed = new EmbedBuilder()
        .setDescription(`${interaction.user.username} punched ${targetUser.username}! 👊`)
        .setImage(getRandomGif('punch'))
        .setColor('#DC143C');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Punch command error:', error);
      await interaction.reply({
        content: 'Failed to execute punch. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
