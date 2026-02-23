import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAllAFK, buildAFKListEmbed } from '../helpers';

const command: BotCommand = {
  module: 'afk',
  permissionPath: 'afk.afklist',
  premium: false,
  data: new SlashCommandBuilder()
    .setName('afklist')
    .setDescription('View all AFK users in this server'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const afkUsers = await getAllAFK(interaction.guildId!);
      const embed = buildAFKListEmbed(afkUsers);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in /afklist command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching AFK users.',
      });
    }
  },
};

export default command;
