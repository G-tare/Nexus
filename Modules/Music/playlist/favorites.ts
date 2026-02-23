import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  saveFavorite,
  removeFavorite,
  getFavorites,
} from '../helpers';

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
        ephemeral: true,
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
              ephemeral: true,
            });
            return;
          }

          const favorites = await getFavorites(userId);
          if (favorites.length >= 500) {
            await interaction.reply({
              content: 'You have reached the maximum of 500 favorite tracks.',
              ephemeral: true,
            });
            return;
          }

          // Check if already favorited
          if (favorites.some((f) => (f as any).identifier === (currentTrack as any).identifier)) {
            await interaction.reply({
              content: `**${(currentTrack as any).title}** is already in your favorites.`,
              ephemeral: true,
            });
            return;
          }

          await saveFavorite(userId, currentTrack);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Added to Favorites')
            .setDescription(`**${(currentTrack as any).title}** added to your favorites.`)
            .setFooter({ text: `${favorites.length + 1}/500 favorites` });

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'remove': {
          const position = interaction.options.getString('position', true);

          const favorites = await getFavorites(userId);
          if (favorites.length === 0) {
            await interaction.reply({
              content: 'You have no favorite tracks.',
              ephemeral: true,
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
                ephemeral: true,
              });
              return;
            }
            trackToRemove = favorites[idx];
          }

          if (!trackToRemove) {
            await interaction.reply({
              content: 'Could not find the track to remove.',
              ephemeral: true,
            });
            return;
          }

          await removeFavorite(userId, (trackToRemove as any).identifier);

          const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Removed from Favorites')
            .setDescription(`**${trackToRemove.title}** removed from your favorites.`);

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'list': {
          const favorites = await getFavorites(userId);

          if (favorites.length === 0) {
            await interaction.reply({
              content: 'You have no favorite tracks yet.',
              ephemeral: true,
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

          const embed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('Your Favorite Tracks')
            .setDescription(
              tracks +
                (favorites.length > 20
                  ? `\n\n+${favorites.length - 20} more track(s)`
                  : '')
            )
            .setFooter({
              text: `${favorites.length}/500 favorites`,
            });

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'play': {
          const favorites = await getFavorites(userId);

          if (favorites.length === 0) {
            await interaction.reply({
              content: 'You have no favorite tracks to play.',
              ephemeral: true,
            });
            return;
          }

          // TODO: Add all favorites to queue
          // await player.queue.add(...favorites);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Favorites Queued')
            .setDescription(
              `Added all **${favorites.length}** favorite track(s) to the queue.`
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    } catch (error) {
      console.error('Error in favorites command:', error);
      await interaction.reply({
        content: 'An error occurred while managing your favorites.',
        ephemeral: true,
      });
    }
  },
};

export default command;
