import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { fetchImage, buildImageEmbed, getImagesConfig } from '../helpers';
import { v2Payload } from '../../../Shared/src/utils/componentsV2';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Images');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('img-bird')
    .setDescription('Get a random bird image'),

  module: 'images',
  permissionPath: 'images.bird',
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command only works in servers.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const config = await getImagesConfig(interaction.guildId!);

    if (!config.enabled) {
      await interaction.reply({
        content: '❌ Images module is disabled on this server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await interaction.deferReply();
      const imageUrl = await fetchImage('https://some-random-api.com/animal/bird');
      const embed = buildImageEmbed('🐦 Random Bird', imageUrl, config.embedColor);
      await interaction.editReply(v2Payload([embed]));
    } catch (error) {
      logger.error('Error fetching bird:', error);
      await interaction.editReply('❌ Failed to fetch bird image. Try again later.');
    }
  },
};

export default command;
