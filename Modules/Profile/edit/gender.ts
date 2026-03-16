import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getProfile, updateProfile, getProfileConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('gender')
    .setDescription('Set your gender')
    .addStringOption((opt) =>
      opt
        .setName('text')
        .setDescription('Your gender')
        .setMaxLength(50)
        .setRequired(true)
    ),

  module: 'profile',
  permissionPath: 'profile.edit.gender',

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

    const gender = interaction.options.getString('text', true);
    const profile = await getProfile(interaction.guildId!, interaction.user.id);

    if (!profile) {
      await interaction.reply({
        content: '❌ You need to create a profile first with `/profile create`',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await updateProfile(interaction.guildId!, interaction.user.id, 'gender', gender);

    await interaction.reply({
      content: `✅ Your gender has been updated to: "${gender}"`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
