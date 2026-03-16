import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getProfile, deleteProfile, getProfileConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Profile');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Delete your profile'),

  module: 'profile',
  permissionPath: 'profile.delete',

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

    const profile = await getProfile(interaction.guildId!, interaction.user.id);

    if (!profile) {
      await interaction.reply({
        content: '❌ You don\'t have a profile to delete.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`profile_delete_confirm_${interaction.id}`)
        .setLabel('Delete Profile')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`profile_delete_cancel_${interaction.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    const response = await interaction.reply({
      content: '⚠️ Are you sure you want to delete your profile? This cannot be undone.',
      components: [confirmRow],
      flags: MessageFlags.Ephemeral,
    });

    try {
      const buttonInteraction = await response.awaitMessageComponent({
        time: 60000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      if (buttonInteraction.customId === `profile_delete_confirm_${interaction.id}`) {
        await deleteProfile(interaction.guildId!, interaction.user.id);

        await buttonInteraction.update({
          content: '✅ Your profile has been deleted.',
          components: [],
        });
      } else {
        await buttonInteraction.update({
          content: '❌ Delete cancelled.',
          components: [],
        });
      }
    } catch (error) {
      await response.edit({
        content: '⚠️ Button interaction timed out. Profile was not deleted.',
        components: [],
      });
    }
  },
};

export default command;
