import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { removeSound, getSound } from '../helpers';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('soundboard-remove')
    .setDescription('Remove a custom sound from the soundboard')
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Sound name to remove')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  module: 'soundboard',
  permissionPath: 'soundboard.manage.remove',

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const soundName = interaction.options.getString('name', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      // Check staff permission
      const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

      if (!isStaff) {
        await interaction.editReply({
          content: '❌ Only staff can remove sounds.',
        });
        return;
      }

      // Get the sound
      const sound = await getSound(guildId, soundName);

      if (!sound) {
        await interaction.editReply({
          content: `❌ Sound "${soundName}" not found.`,
        });
        return;
      }

      if (sound.isDefault) {
        await interaction.editReply({
          content: '❌ Cannot remove default sounds.',
        });
        return;
      }

      // Remove the sound
      const success = await removeSound(guildId, soundName);

      if (!success) {
        await interaction.editReply({
          content: 'An error occurred while removing the sound.',
        });
        return;
      }

      const container = moduleContainer('soundboard');
      addText(container, `### ✅ Sound Removed\nSound **${sound.name}** has been removed.`);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in soundboard remove command:', error);
      await interaction.editReply({
        content: 'An error occurred while removing the sound.',
      });
    }
  },
};

export default command;
