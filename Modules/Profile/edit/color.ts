import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getProfile, updateProfile, getProfileConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('profile-color')
    .setDescription('Set your profile embed color')
    .addStringOption((opt) =>
      opt
        .setName('hex')
        .setDescription('Hex color code (#RRGGBB)')
        .setMaxLength(7)
        .setRequired(true)
    ),

  module: 'profile',
  permissionPath: 'profile.edit.color',

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

    const hex = interaction.options.getString('hex', true);

    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexRegex.test(hex)) {
      await interaction.reply({
        content: '❌ Invalid hex color. Please use format #RRGGBB (e.g., #FF5733)',
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

    await updateProfile(interaction.guildId!, interaction.user.id, 'profileColor', hex);

    await interaction.reply({
      content: `✅ Your profile color has been set to: ${hex}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
