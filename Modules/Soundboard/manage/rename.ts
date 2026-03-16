import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { renameSound, getSound } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('soundboard-rename')
    .setDescription('Rename a sound')
    .addStringOption((opt) =>
      opt
        .setName('old-name')
        .setDescription('Current sound name')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('new-name')
        .setDescription('New sound name')
        .setRequired(true)
    ),

  module: 'soundboard',
  permissionPath: 'soundboard.manage.rename',

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const oldName = interaction.options.getString('old-name', true);
    const newName = interaction.options.getString('new-name', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      // Check staff permission
      const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

      if (!isStaff) {
        await interaction.editReply({
          content: '❌ Only staff can rename sounds.',
        });
        return;
      }

      // Get the sound
      const sound = await getSound(guildId, oldName);

      if (!sound) {
        await interaction.editReply({
          content: `❌ Sound "${oldName}" not found.`,
        });
        return;
      }

      // Rename the sound
      const renamed = await renameSound(guildId, oldName, newName);

      if (!renamed) {
        await interaction.editReply({
          content: 'An error occurred while renaming the sound.',
        });
        return;
      }

      const container = moduleContainer('soundboard');
      addText(container, '### ✅ Sound Renamed');
      addFields(container, [
        {
          name: 'Old Name',
          value: `\`${oldName}\``,
          inline: true,
        },
        {
          name: 'New Name',
          value: `\`${newName}\``,
          inline: true,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in soundboard rename command:', error);
      await interaction.editReply({
        content: 'An error occurred while renaming the sound.',
      });
    }
  },
};

export default command;
