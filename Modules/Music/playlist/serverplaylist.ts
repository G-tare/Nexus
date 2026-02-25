import { 
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  Colors, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  saveServerPlaylist,
  loadServerPlaylist,
  getServerPlaylists,
  deleteServerPlaylist,
} from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

const command: BotCommand = {
  name: 'serverplaylist',
  module: 'music',
  permissionPath: 'music.serverplaylist',
  data: new SlashCommandBuilder()
    .setName('serverplaylist')
    .setDescription('Manage server-wide playlists')
    .addSubcommand((sub) =>
      sub
        .setName('save')
        .setDescription('Save current queue as a server playlist')
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
        .setDescription('Load a server playlist into the queue')
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
        .setDescription('Delete a server playlist (requires Manage Guild)')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Playlist name to delete')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all server playlists')
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View tracks in a server playlist')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Playlist name to view')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if server playlists are enabled
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'music');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
    if (!config.serverPlaylistsEnabled) {
      await interaction.reply({
        content: 'Server playlists are disabled for this server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      switch (subcommand) {
        case 'save': {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({
              content: 'You need the **Manage Guild** permission to save server playlists.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const name = interaction.options.getString('name', true);

          const playlists = await getServerPlaylists(guildId);
          if (playlists.length >= 100) {
            await interaction.reply({
              content: 'This server has reached the maximum of 100 playlists.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // TODO: Get current queue from player
          const queue: any[] = [];

          if (queue.length === 0) {
            await interaction.reply({
              content: 'The queue is empty. Nothing to save.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          await saveServerPlaylist(guildId, name, queue, interaction.user.id);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Server Playlist Saved')
            .setDescription(
              `Saved **${name}** with **${queue.length}** track(s).`
            )
            .setFooter({ text: `${playlists.length + 1}/100 playlists` });

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'load': {
          const name = interaction.options.getString('name', true);

          const playlist = await loadServerPlaylist(guildId, name);
          if (!playlist || (playlist as any).tracks.length === 0) {
            await interaction.reply({
              content: `Server playlist **${name}** not found or is empty.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // TODO: Add tracks to queue
          // await player.queue.add(...playlist.tracks);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Server Playlist Loaded')
            .setDescription(
              `Added **${(playlist as any).tracks.length}** track(s) from **${name}** to the queue.`
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'delete': {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({
              content: 'You need the **Manage Guild** permission to delete server playlists.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const name = interaction.options.getString('name', true);

          const deleted = await deleteServerPlaylist(guildId, name);
          if (!deleted) {
            await interaction.reply({
              content: `Server playlist **${name}** not found.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Server Playlist Deleted')
            .setDescription(`Deleted server playlist **${name}**.`);

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'list': {
          const playlists = await getServerPlaylists(guildId);

          if (playlists.length === 0) {
            await interaction.reply({
              content: 'This server has no playlists yet.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const list = playlists
            .map((p, i) => `**${i + 1}.** ${(p as any).name} (${(p as any).tracks.length} tracks)`)
            .join('\n');

          const embed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('Server Playlists')
            .setDescription(list)
            .setFooter({
              text: `${playlists.length}/100 playlists`,
            });

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'view': {
          const name = interaction.options.getString('name', true);

          const playlist = await loadServerPlaylist(guildId, name);
          if (!playlist || (playlist as any).tracks.length === 0) {
            await interaction.reply({
              content: `Server playlist **${name}** not found or is empty.`,
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
      console.error('Error in server playlist command:', error);
      await interaction.reply({
        content: 'An error occurred while managing server playlists.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
