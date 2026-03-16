import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
  AutocompleteInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getProfile, removeFromList, getProfileConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('list-remove')
    .setDescription('Remove item from a favorite list')
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
        .setDescription('Item to remove')
        .setAutocomplete(true)
        .setRequired(true)
    ),

  module: 'profile',
  permissionPath: 'profile.lists.remove',

  autocomplete: async (interaction: AutocompleteInteraction) => {
    if (!interaction.guild) return;

    const category = interaction.options.getString('category', true) as
      | 'favoriteActors'
      | 'favoriteArtists'
      | 'favoriteFoods'
      | 'hobbies'
      | 'favoriteMovies'
      | 'pets'
      | 'favoriteSongs';

    const profile = await getProfile(interaction.guildId!, interaction.user.id);
    if (!profile) return;

    const list = (profile[category] as string[]) || [];

    await interaction.respond(list.slice(0, 25).map((item) => ({ name: item, value: item })));
  },

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

    const list = (profile[category] as string[]) || [];
    if (!list.includes(item)) {
      await interaction.reply({
        content: `❌ "${item}" is not in your ${categoryNames[category]} list.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await removeFromList(interaction.guildId!, interaction.user.id, category, item);

    await interaction.reply({
      content: `✅ Removed "${item}" from your ${categoryNames[category]} list!`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
