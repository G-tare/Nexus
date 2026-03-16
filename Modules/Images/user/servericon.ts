import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getImagesConfig } from '../helpers';
import { moduleContainer, addSectionWithThumbnail, addFields, addFooter, errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('servericon')
    .setDescription('Show server icon in full size'),

  module: 'images',
  permissionPath: 'images.servericon',
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

    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: '❌ This command only works in servers.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const iconUrl = guild.iconURL({ size: 512 });

    if (!iconUrl) {
      const container = errorContainer('No Icon', `${guild.name} doesn't have an icon set.`);
      await interaction.reply(v2Payload([container]));
      return;
    }

    const sizes = [128, 256, 512, 1024];
    const fields = sizes.map((size) => ({
      name: `${size}x${size}`,
      value: `[PNG](${guild.iconURL({ size, extension: 'png' })}) | [JPG](${guild.iconURL({ size, extension: 'jpg' })}) | [WebP](${guild.iconURL({ size, extension: 'webp' })})`,
      inline: true,
    }));

    const container = moduleContainer('images');
    addSectionWithThumbnail(container, `### ${guild.name}'s Icon`, iconUrl);
    addFields(container, fields);
    addFooter(container, 'Click links to download different sizes');

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
