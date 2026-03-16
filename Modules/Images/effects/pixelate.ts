import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getUserAvatarUrl, getImagesConfig } from '../helpers';
import { moduleContainer, addSectionWithThumbnail, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('pixelate')
    .setDescription('Pixelate a user avatar')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User avatar to pixelate').setRequired(true)
    ),

  module: 'images',
  permissionPath: 'images.pixelate',
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

    const container = moduleContainer('images');
    addSectionWithThumbnail(container, `### 📦 ${targetUser.username}'s Pixelated Avatar`, avatarUrl);
    addText(container, 'Pixelation effect requires image processing library. Coming soon!');

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
