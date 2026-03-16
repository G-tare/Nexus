import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getProfile, addToList, getProfileConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('list-add')
    .setDescription('Add item to a favorite list')
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Category')
        .addChoices(
          { name: 'Actor', value: 'favoriteActors' },
          { name: 'Artist', value: 'favoriteArtists' },
          { name: 'Food', value: 'favoriteFoods' },
          { name: 'Hobby', value: 'hobbies' },
          { name: 'Movie', value: 'favoriteMovies' },
          { name: 'Pet', value: 'pets' },
          { name: 'Song', value: 'favoriteSongs' }
        )
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('item')
        .setDescription('Item to add')
        .setMaxLength(100)
        .setRequired(true)
    ),

  module: 'profile',
  permissionPath: 'profile.lists.add',

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

    const category = interaction.options.getString('category', true) as
      | 'favoriteActors'
      | 'favoriteArtists'
      | 'favoriteFoods'
      | 'hobbies'
      | 'favoriteMovies'
      | 'pets'
      | 'favoriteSongs';
    const item = interaction.options.getString('item', true);

    const profile = await getProfile(interaction.guildId!, interaction.user.id);

    if (!profile) {
      await interaction.reply({
        content: '❌ You need to create a profile first with `/profile create`',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const categoryNames: Record<string, string> = {
      favoriteActors: 'Actor',
      favoriteArtists: 'Artist',
      favoriteFoods: 'Food',
      hobbies: 'Hobby',
      favoriteMovies: 'Movie',
      pets: 'Pet',
      favoriteSongs: 'Song',
    };

    const updated = await addToList(interaction.guildId!, interaction.user.id, category, item, config.maxListItems);

    if (updated === null) {
      await interaction.reply({
        content: `❌ This item is already in your list or you've reached the max of ${config.maxListItems} items.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `✅ Added "${item}" to your ${categoryNames[category]} list!`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
