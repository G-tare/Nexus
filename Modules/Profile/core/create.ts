import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getProfile, createProfile, getProfileConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Profile');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create your profile'),

  module: 'profile',
  permissionPath: 'profile.create',

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

    const existingProfile = await getProfile(interaction.guildId!, interaction.user.id);

    if (existingProfile) {
      await interaction.reply({
        content: '❌ You already have a profile! Use `/profile edit` commands to modify it.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`profile_create_${interaction.id}`)
      .setTitle('Create Your Profile');

    const aboutMeInput = new TextInputBuilder()
      .setCustomId('aboutme')
      .setLabel('About Me')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Tell us about yourself...')
      .setMaxLength(256)
      .setRequired(false);

    const statusInput = new TextInputBuilder()
      .setCustomId('status')
      .setLabel('Status')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('What are you up to?')
      .setMaxLength(128)
      .setRequired(false);

    const locationInput = new TextInputBuilder()
      .setCustomId('location')
      .setLabel('Location')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Where are you from?')
      .setMaxLength(100)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(aboutMeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(statusInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(locationInput)
    );

    await interaction.showModal(modal);

    try {
      const submitted = await interaction.awaitModalSubmit({
        time: 15 * 60 * 1000,
        filter: (i) => i.customId === `profile_create_${interaction.id}`,
      });

      const aboutMe = submitted.fields.getTextInputValue('aboutme') || null;
      const status = submitted.fields.getTextInputValue('status') || null;
      const location = submitted.fields.getTextInputValue('location') || null;

      const newProfile = await createProfile(interaction.guildId!, interaction.user.id, {
        aboutMe: aboutMe ? aboutMe : null,
        status: status ? status : null,
        location: location ? location : null,
      });

      await submitted.reply({
        content: '✅ Profile created successfully!',
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('Modal timeout or error:', error);
    }
  },
};

export default command;
