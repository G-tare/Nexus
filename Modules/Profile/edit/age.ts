import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getProfile, updateProfile, getProfileConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('age')
    .setDescription('Set your age')
    .addIntegerOption((opt) =>
      opt
        .setName('number')
        .setDescription('Your age (13-120)')
        .setMinValue(13)
        .setMaxValue(120)
        .setRequired(true)
    ),

  module: 'profile',
  permissionPath: 'profile.edit.age',

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

    const age = interaction.options.getInteger('number', true);
    const profile = await getProfile(interaction.guildId!, interaction.user.id);

    if (!profile) {
      await interaction.reply({
        content: '❌ You need to create a profile first with `/profile create`',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await updateProfile(interaction.guildId!, interaction.user.id, 'age', age);

    await interaction.reply({
      content: `✅ Your age has been set to ${age}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
