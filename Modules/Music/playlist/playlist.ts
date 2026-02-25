import { 
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  Colors, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  savePersonalPlaylist,
  loadPersonalPlaylist,
  getPersonalPlaylists,
  deletePersonalPlaylist,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage your personal playlists')
    .addSubcommand((sub) =>
      sub
        .setName('save')
        .setDescription('Save current queue as a personal playlist')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Playlist name (max 50 characters)')
            .setRequired(true)
            .setMaxLength(50)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('load')
        .setDescription('Load a personal playlist into the queue')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Playlist name to load')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a personal playlist')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Playlist name to delete')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all your personal playlists')
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View tracks in a personal playlist')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Playlist name to view')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  module: 'music',
  permissionPath: 'music.playlist',

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      switch (subcommand) {
        case 'save': {
          const name = interaction.options.getString('name', true);

          const playlists = await getPersonalPlaylists(userId);
          if (playlists.length >= 25) {
            await interaction.reply({
              content: 'You have reached the maximum of 25 personal playlists.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // TODO: Get current queue from player
          // const queue = player.queue.current ? [player.queue.current, ...player.queue] : [];
          const queue: any[] = [];

          if (queue.length === 0) {
            await interaction.reply({
              content: 'The queue is empty. Nothing to save.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          await savePersonalPlaylist(userId, name, queue);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Playlist Saved')
            .setDescription(
              `Saved **${name}** with **${queue.length}** track(s).`
            )
            .setFooter({ text: `${playlists.length + 1}/25 playlists` });

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'load': {
          const name = interaction.options.getString('name', true);

          const playlist = await loadPersonalPlaylist(userId, name);
          if (!playlist || (playlist as any).tracks.length === 0) {
            await interaction.reply({
              content: `Playlist **${name}** not found or is empty.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // TODO: Add tracks to queue
          // await player.queue.add(...playlist.tracks);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Playlist Loaded')
            .setDescription(
              `Added **${(playlist as any).tracks.length}** track(s) from **${name}** to the queue.`
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'delete': {
          const name = interaction.options.getString('name', true);

          const deleted = await deletePersonalPlaylist(userId, name);
          if (!deleted) {
            await interaction.reply({
              content: `Playlist **${name}** not found.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Playlist Deleted')
            .setDescription(`Deleted playlist **${name}**.`);

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'list': {
          const playlists = await getPersonalPlaylists(userId);

          if (playlists.length === 0) {
            await interaction.reply({
              content: 'You have no personal playlists yet.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const list = playlists
            .map((p, i) => `**${i + 1}.** ${(p as any).name} (${(p as any).tracks.length} tracks)`)
            .join('\n');

          const embed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('Your Playlists')
            .setDescription(list)
            .setFooter({
              text: `${playlists.length}/25 playlists`,
            });

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'view': {
          const name = interaction.options.getString('name', true);

          const playlist = await loadPersonalPlaylist(userId, name);
          if (!playlist || (playlist as any).tracks.length === 0) {
            await interaction.reply({
              content: `Playlist **${name}** not found or is empty.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const tracks = (playlist as any).tracks
            .slice(0, 20)
            .map(
              (t: any, i: any) =>
                `**${i + 1}.** ${t.title || 'Unknown'} (${Math.floor(t.duration / 1000)}s)`
            )
            .join('\n');

          const embed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle(`${name}`)
            .setDescription(
              tracks ||
                'No tracks in this playlist.' +
                  ((playlist as any).tracks.length > 20
                    ? `\n\n+${(playlist as any).tracks.length - 20} more tracks`
                    : '')
            )
            .setFooter({
              text: `${(playlist as any).tracks.length} total track(s)`,
            });

          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    } catch (error) {
      console.error('Error in playlist command:', error);
      await interaction.reply({
        content: 'An error occurred while managing playlists.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
