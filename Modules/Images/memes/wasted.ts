import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { buildImageEmbed, getUserAvatarUrl, getImagesConfig } from '../helpers';
import { v2Payload } from '../../../Shared/src/utils/componentsV2';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Images');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('wasted')
    .setDescription('Add GTA "Wasted" overlay to user avatar')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to apply effect to').setRequired(true)
    ),

  module: 'images',
  permissionPath: 'images.wasted',
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

    const targetUser = interaction.options.getUser('user', true);
    const avatarUrl = getUserAvatarUrl(targetUser);

    try {
      await interaction.deferReply();
      const imageUrl = `https://some-random-api.com/canvas/overlay/wasted?avatar=${encodeURIComponent(avatarUrl)}`;
      const embed = buildImageEmbed(`💀 ${targetUser.username} has been wasted!`, imageUrl, config.embedColor);
      await interaction.editReply(v2Payload([embed]));
    } catch (error) {
      logger.error('Error creating wasted overlay:', error);
      await interaction.editReply('❌ Failed to create wasted overlay. Try again later.');
    }
  },
};

export default command;
