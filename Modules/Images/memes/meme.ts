import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getImagesConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addMediaGallery, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Images');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('img-meme')
    .setDescription('Get a random meme from Reddit'),

  module: 'images',
  permissionPath: 'images.meme',
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
      const response = await fetch('https://meme-api.com/gimme');
      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = (await response.json()) as Record<string, unknown>;

      const container = moduleContainer('images');
      addMediaGallery(container, [{ url: (data.url as string) || '', description: (data.title as string) || 'Random Meme' }]);
      addFooter(container, `Posted in r/${data.subreddit as string}`);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error('Error fetching meme:', error);
      await interaction.editReply('❌ Failed to fetch meme. Try again later.');
    }
  },
};

export default command;
