import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getProfile, updateProfile, getProfileConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('aboutme')
    .setDescription('Set your about me text')
    .addStringOption((opt) =>
      opt
        .setName('text')
        .setDescription('Your about me text')
        .setMaxLength(256)
        .setRequired(true)
    ),

  module: 'profile',
  permissionPath: 'profile.edit.aboutme',

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

    const text = interaction.options.getString('text', true);
    const profile = await getProfile(interaction.guildId!, interaction.user.id);

    if (!profile) {
      await interaction.reply({
        content: '❌ You need to create a profile first with `/profile create`',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await updateProfile(interaction.guildId!, interaction.user.id, 'aboutMe', text);

    await interaction.reply({
      content: `✅ Your about me has been updated to: "${text}"`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
