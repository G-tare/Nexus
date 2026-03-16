import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getProfile, updateProfile, getProfileConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('location')
    .setDescription('Set your location')
    .addStringOption((opt) =>
      opt
        .setName('text')
        .setDescription('Your location')
        .setMaxLength(100)
        .setRequired(true)
    ),

  module: 'profile',
  permissionPath: 'profile.edit.location',

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

    const location = interaction.options.getString('text', true);
    const profile = await getProfile(interaction.guildId!, interaction.user.id);

    if (!profile) {
      await interaction.reply({
        content: '❌ You need to create a profile first with `/profile create`',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await updateProfile(interaction.guildId!, interaction.user.id, 'location', location);

    await interaction.reply({
      content: `✅ Your location has been updated to: "${location}"`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
