import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAllAFK, buildAFKListContainer } from '../helpers';
import { v2Payload } from '../../../Shared/src/utils/componentsV2';

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
      const container = buildAFKListContainer(afkUsers);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in /afklist command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching AFK users.',
      });
    }
  },
};

export default command;
