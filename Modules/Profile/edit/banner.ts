import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getProfile, updateProfile, getProfileConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription('Set your profile banner image')
    .addStringOption((opt) =>
      opt
        .setName('url')
        .setDescription('Image URL')
        .setRequired(true)
    ),

  module: 'profile',
  permissionPath: 'profile.edit.banner',

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command only works in servers.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const config = await getProfileConfig(interaction.guildId!);

    if (!config.enabled) {
      await interaction.reply({
        content: '❌ Profile module is disabled on this server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const url = interaction.options.getString('url', true);

    try {
      const urlObj = new URL(url);
      if (!['http', 'https'].includes(urlObj.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      await interaction.reply({
        content: '❌ Invalid URL. Please provide a valid HTTP(S) image URL.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const profile = await getProfile(interaction.guildId!, interaction.user.id);

    if (!profile) {
      await interaction.reply({
        content: '❌ You need to create a profile first with `/profile create`',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await updateProfile(interaction.guildId!, interaction.user.id, 'bannerUrl', url);

    await interaction.reply({
      content: '✅ Your banner has been updated!',
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
