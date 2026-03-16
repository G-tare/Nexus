import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { buildImageEmbed, getImagesConfig } from '../helpers';
import { v2Payload } from '../../../Shared/src/utils/componentsV2';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Images');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('img-fox')
    .setDescription('Get a random fox image'),

  module: 'images',
  permissionPath: 'images.fox',
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
      const response = await fetch('https://randomfox.ca/floof/');
      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = (await response.json()) as Record<string, unknown>;
      if (typeof data.image !== 'string') throw new Error('No image URL in response');

      const embed = buildImageEmbed('🦊 Random Fox', data.image, config.embedColor);
      await interaction.editReply(v2Payload([embed]));
    } catch (error) {
      logger.error('Error fetching fox:', error);
      await interaction.editReply('❌ Failed to fetch fox image. Try again later.');
    }
  },
};

export default command;
