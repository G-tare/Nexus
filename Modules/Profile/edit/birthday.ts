import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getProfile, updateProfile, getProfileConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('profile-birthday')
    .setDescription('Set your birthday')
    .addStringOption((opt) =>
      opt
        .setName('date')
        .setDescription('Your birthday in MM/DD format')
        .setMaxLength(20)
        .setRequired(true)
    ),

  module: 'profile',
  permissionPath: 'profile.edit.birthday',

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

    const dateStr = interaction.options.getString('date', true);

    const dateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])$/;
    if (!dateRegex.test(dateStr)) {
      await interaction.reply({
        content: '❌ Invalid date format. Please use MM/DD (e.g., 12/25)',
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

    await updateProfile(interaction.guildId!, interaction.user.id, 'birthday', dateStr);

    await interaction.reply({
      content: `✅ Your birthday has been set to: ${dateStr}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
