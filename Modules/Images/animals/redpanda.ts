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
    .setName('img-redpanda')
    .setDescription('Get a random red panda image'),

  module: 'images',
  permissionPath: 'images.redpanda',
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
      const imageUrl = await fetchImage('https://some-random-api.com/animal/red_panda');
      const embed = buildImageEmbed('🔴 Random Red Panda', imageUrl, config.embedColor);
      await interaction.editReply(v2Payload([embed]));
    } catch (error) {
      logger.error('Error fetching red panda:', error);
      await interaction.editReply('❌ Failed to fetch red panda image. Try again later.');
    }
  },
};

export default command;
