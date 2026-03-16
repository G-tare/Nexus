import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getImagesConfig } from '../helpers';
import { moduleContainer, addSectionWithThumbnail, errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('img-banner')
    .setDescription('Show user banner (if they have one)')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to view (defaults to you)')
    ),

  module: 'images',
  permissionPath: 'images.banner',
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

    try {
      const userFull = await interaction.client.users.fetch(targetUser.id, { force: true });
      const bannerUrl = userFull.bannerURL({ size: 512 });

      if (!bannerUrl) {
        const container = errorContainer('No Banner', `${targetUser.username} doesn't have a banner set.`);
        await interaction.reply(v2Payload([container]));
        return;
      }

      const container = moduleContainer('images');
      addSectionWithThumbnail(container, `### ${targetUser.username}'s Banner`, bannerUrl);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      const container = errorContainer('Error', 'Could not fetch banner. User may not have one set.');
      await interaction.reply({ ...v2Payload([container]), flags: MessageFlags.Ephemeral });
    }
  },
};

export default command;
