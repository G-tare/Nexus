import {
  SlashCommandBuilder,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  saveFavorite,
  removeFavorite,
  getFavorites,
} from '../helpers';
import { successContainer, errorContainer, moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  name: 'favorites',
  module: 'music',
  permissionPath: 'music.favorites',
  data: new SlashCommandBuilder()
    .setName('favorites')
    .setDescription('Manage your favorite tracks')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add the current track to your favorites')
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a track from your favorites')
        .addStringOption((opt) =>
          opt
            .setName('position')
            .setDescription('Position number or "current" to remove current track')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all your favorite tracks')
    )
    .addSubcommand((sub) =>
      sub
        .setName('play')
        .setDescription('Play all your favorite tracks')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId!;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      switch (subcommand) {
        case 'add': {
          // TODO: Get current track from player
          // const currentTrack = player.queue.current;
          const currentTrack = null;

          if (!currentTrack) {
            await interaction.reply({
              content: 'No track is currently playing.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const favorites = await getFavorites(userId);
          if (favorites.length >= 500) {
            await interaction.reply({
              content: 'You have reached the maximum of 500 favorite tracks.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // Check if already favorited
          if (favorites.some((f) => (f as any).identifier === (currentTrack as any).identifier)) {
            await interaction.reply({
              content: `**${(currentTrack as any).title}** is already in your favorites.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          await saveFavorite(userId, currentTrack);

          const container = successContainer('Added to Favorites', `**${(currentTrack as any).title}** added to your favorites.`);
          addFooter(container, `${favorites.length + 1}/500 favorites`);

          await interaction.reply(v2Payload([container]));
          break;
        }

        case 'remove': {
          const position = interaction.options.getString('position', true);

          const favorites = await getFavorites(userId);
          if (favorites.length === 0) {
            await interaction.reply({
              content: 'You have no favorite tracks.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          let trackToRemove;

          if (position.toLowerCase() === 'current') {
            // TODO: Get current track from player
            // trackToRemove = player.queue.current;
            trackToRemove = null;
          } else {
            const idx = parseInt(position, 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= favorites.length) {
              await interaction.reply({
                content: `Invalid position. Please enter a number between 1 and ${favorites.length}.`,
                flags: MessageFlags.Ephemeral,
              });
              return;
            }
            trackToRemove = favorites[idx];
          }

          if (!trackToRemove) {
            await interaction.reply({
              content: 'Could not find the track to remove.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          await removeFavorite(userId, (trackToRemove as any).identifier);

          const container = errorContainer('Removed from Favorites', `**${trackToRemove.title}** removed from your favorites.`);

          await interaction.reply(v2Payload([container]));
          break;
        }

        case 'list': {
          const favorites = await getFavorites(userId);

          if (favorites.length === 0) {
            await interaction.reply({
              content: 'You have no favorite tracks yet.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const tracks = favorites
            .slice(0, 20)
            .map(
              (t, i) =>
                `**${i + 1}.** ${t.title || 'Unknown'} (${Math.floor(t.duration / 1000)}s)`
            )
            .join('\n');

          const container = moduleContainer('music');
          addText(container, `### Your Favorite Tracks\n${tracks}${favorites.length > 20 ? `\n\n+${favorites.length - 20} more track(s)` : ''}`);
          addFooter(container, `${favorites.length}/500 favorites`);

          await interaction.reply(v2Payload([container]));
          break;
        }

        case 'play': {
          const favorites = await getFavorites(userId);

          if (favorites.length === 0) {
            await interaction.reply({
              content: 'You have no favorite tracks to play.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // TODO: Add all favorites to queue
          // await player.queue.add(...favorites);

          const container = successContainer('Favorites Queued', `Added all **${favorites.length}** favorite track(s) to the queue.`);

          await interaction.reply(v2Payload([container]));
          break;
        }
      }
    } catch (error) {
      console.error('Error in favorites command:', error);
      await interaction.reply({
        content: 'An error occurred while managing your favorites.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
