import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
  User,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getProfile, getProfileConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addSectionWithThumbnail, addFields, addFooter, errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Profile');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('view')
    .setDescription('View a user profile')
    .addUserOption((opt) => opt.setName('user').setDescription('The user to view (defaults to you)')),

  module: 'profile',
  permissionPath: 'profile.view',

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command only works in servers.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const config = await getProfileConfig(interaction.guildId!);

    if (!config.enabled) {
      await interaction.reply({
        content: '❌ Profile module is disabled on this server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const profile = await getProfile(interaction.guildId!, targetUser.id);

    if (!profile) {
      const container = errorContainer(
        '❌ No Profile Found',
        targetUser.id === interaction.user.id
          ? `You don't have a profile yet! Create one with \`/profile create\``
          : `${targetUser.username} doesn't have a profile yet.`
      );

      await interaction.reply({ ...v2Payload([container]), flags: MessageFlags.Ephemeral });
      return;
    }

    const container = moduleContainer('profile');

    // Add title section with thumbnail
    const avatarUrl = targetUser.displayAvatarURL({ size: 256 });
    addSectionWithThumbnail(container, `### ${targetUser.username}'s Profile`, avatarUrl);

    // Add about me if exists
    if (profile.aboutMe) {
      addText(container, `**About Me**\n${profile.aboutMe}`);
    }

    // Add inline fields
    const inlineFields: Array<{ name: string; value: string; inline?: boolean }> = [];

    if (profile.age !== null) {
      inlineFields.push({ name: 'Age', value: profile.age.toString(), inline: true });
    }

    if (profile.gender) {
      inlineFields.push({ name: 'Gender', value: profile.gender, inline: true });
    }

    if (profile.location) {
      inlineFields.push({ name: 'Location', value: profile.location, inline: true });
    }

    if (profile.birthday) {
      inlineFields.push({ name: 'Birthday', value: profile.birthday, inline: true });
    }

    if (inlineFields.length > 0) {
      addFields(container, inlineFields);
    }

    if (profile.status) {
      addText(container, `**Status**\n${profile.status}`);
    }

    // Add lists
    const listFields = [
      { icon: '🎬', name: 'Movies', list: profile.favoriteMovies as string[] },
      { icon: '🎤', name: 'Artists', list: profile.favoriteArtists as string[] },
      { icon: '🎵', name: 'Songs', list: profile.favoriteSongs as string[] },
      { icon: '🍕', name: 'Foods', list: profile.favoriteFoods as string[] },
      { icon: '🎭', name: 'Actors', list: profile.favoriteActors as string[] },
      { icon: '🎨', name: 'Hobbies', list: profile.hobbies as string[] },
      { icon: '🐾', name: 'Pets', list: profile.pets as string[] },
    ];

    const listFieldsToAdd = listFields
      .filter(field => field.list && field.list.length > 0)
      .map(field => {
        const displayText = field.list!.slice(0, 3).join(', ') + (field.list!.length > 3 ? '...' : '');
        return { name: `${field.icon} ${field.name}`, value: displayText, inline: true };
      });

    if (listFieldsToAdd.length > 0) {
      addFields(container, listFieldsToAdd);
    }

    addFooter(container, `Profile created: ${profile.createdAt.toLocaleDateString()}`);

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
