import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { fetchImage, buildImageEmbed, getImagesConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addMediaGallery, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Images');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('img-cat')
    .setDescription('Get a random cat image'),

  module: 'images',
  permissionPath: 'images.cat',
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
      const imageUrl = await fetchImage('https://api.thecatapi.com/v1/images/search');
      const container = moduleContainer('images');
      addMediaGallery(container, [{ url: imageUrl, description: '🐱 Random Cat' }]);
      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error('Error fetching cat:', error);
      await interaction.editReply('❌ Failed to fetch cat image. Try again later.');
    }
  },
};

export default command;
