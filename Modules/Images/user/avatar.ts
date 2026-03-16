import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getImagesConfig } from '../helpers';
import { moduleContainer, addSectionWithThumbnail, addFields, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('img-avatar')
    .setDescription('Show user avatar in full size')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to view (defaults to you)')
    ),

  module: 'images',
  permissionPath: 'images.avatar',
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

    const targetUser = interaction.options.getUser('user') ?? interaction.user;

    const sizes = [128, 256, 512, 1024];
    const fields = sizes.map((size) => ({
      name: `${size}x${size}`,
      value: `[PNG](${targetUser.displayAvatarURL({ size, extension: 'png' })}) | [JPG](${targetUser.displayAvatarURL({ size, extension: 'jpg' })}) | [WebP](${targetUser.displayAvatarURL({ size, extension: 'webp' })})`,
      inline: true,
    }));

    const container = moduleContainer('images');
    addSectionWithThumbnail(container, `### ${targetUser.username}'s Avatar`, targetUser.displayAvatarURL({ size: 512 }));
    addFields(container, fields);
    addFooter(container, 'Click links to download different sizes');

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
