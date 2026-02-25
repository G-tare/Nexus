import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getQueue,
  createQueue,
  addTrack,
  joinVC,
  getConnection,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or add it to the queue')
    .addStringOption((option) =>
      option.setName('query')
        .setDescription('Song URL or search term')
        .setRequired(true)
    ),

  module: 'music',
  permissionPath: 'music.play',
  premiumFeature: 'music.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const query = interaction.options.getString('query', true);
    const member = interaction.guild?.members.cache.get(interaction.user.id);

    // Check if user is in a voice channel
    if (!member?.voice.channel) {
      const embed = new EmbedBuilder()
        .setDescription('You must be in a voice channel to use this command.')
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    const voiceChannelId = member.voice.channel.id;

    // Get or create queue
    let queue = getQueue(interaction.guild!.id);
    if (!queue) {
      queue = createQueue(interaction.guild!.id, interaction.channelId!, voiceChannelId);
    }

    // Auto-join: if bot isn't in a voice channel, join the user's VC
    let connection: any = getConnection(interaction.guild!.id);
    if (!connection) {
      connection = await joinVC(interaction.guild!, voiceChannelId);
      if (!connection) {
        const embed = new EmbedBuilder()
          .setDescription('Failed to join your voice channel. Make sure I have permission to connect.')
          .setColor(0xff0000);
        return interaction.editReply({ embeds: [embed] });
      }
      queue.voiceChannelId = voiceChannelId;
    } else if (queue.voiceChannelId !== voiceChannelId) {
      // Bot is in a different VC
      const embed = new EmbedBuilder()
        .setDescription('You must be in the same voice channel as the bot to add songs.')
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    // Parse query to detect source
    const isYouTubeURL = /(?:youtube\.com|youtu\.be)/.test(query);
    const isSpotifyURL = /spotify\.com/.test(query);
    const isSoundCloudURL = /soundcloud\.com/.test(query);
    const isAppleMusicURL = /music\.apple\.com/.test(query);

    let tracks: any[] = [];

    if (isYouTubeURL) {
      // Lavalink: Search for YouTube playlist/track
      // const results = await getShoukaku().rest.resolve(query);
      // if (results.loadType === 'PLAYLIST_LOADED') {
      //   tracks = results.tracks;
      // } else if (results.loadType === 'TRACK_LOADED') {
      //   tracks = [results.tracks[0]];
      // }

      // Placeholder: In production, resolve via Lavalink
      tracks = [
        {
          encoded: 'placeholder_encoded_youtube',
          info: {
            title: 'Sample YouTube Track',
            author: 'Sample Artist',
            length: 180000,
            identifier: 'youtube_id',
            uri: query,
          },
        },
      ];
    } else if (isSpotifyURL) {
      // Lavalink: Resolve Spotify URL
      // const results = await getShoukaku().rest.resolve(query);
      // tracks = results.tracks || [];

      // Placeholder: In production, resolve via Lavalink
      tracks = [
        {
          encoded: 'placeholder_encoded_spotify',
          info: {
            title: 'Sample Spotify Track',
            author: 'Sample Artist',
            length: 200000,
            identifier: 'spotify_id',
            uri: query,
          },
        },
      ];
    } else if (isSoundCloudURL) {
      // Lavalink: Resolve SoundCloud URL
      // const results = await getShoukaku().rest.resolve(query);
      // tracks = results.tracks || [];

      // Placeholder: In production, resolve via Lavalink
      tracks = [
        {
          encoded: 'placeholder_encoded_soundcloud',
          info: {
            title: 'Sample SoundCloud Track',
            author: 'Sample Artist',
            length: 240000,
            identifier: 'soundcloud_id',
            uri: query,
          },
        },
      ];
    } else if (isAppleMusicURL) {
      // Lavalink: Resolve Apple Music URL
      // const results = await getShoukaku().rest.resolve(query);
      // tracks = results.tracks || [];

      // Placeholder: In production, resolve via Lavalink
      tracks = [
        {
          encoded: 'placeholder_encoded_applemusic',
          info: {
            title: 'Sample Apple Music Track',
            author: 'Sample Artist',
            length: 210000,
            identifier: 'applemusic_id',
            uri: query,
          },
        },
      ];
    } else {
      // Plain search query - search via Lavalink
      // const results = await getShoukaku().rest.resolve(`ytsearch:${query}`);
      // if (results.loadType === 'SEARCH_RESULT') {
      //   tracks = results.tracks.slice(0, 1); // First result
      // }

      // Placeholder: In production, search via Lavalink
      tracks = [
        {
          encoded: 'placeholder_encoded_search',
          info: {
            title: query,
            author: 'Search Result Artist',
            length: 200000,
            identifier: 'search_id',
            uri: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
          },
        },
      ];
    }

    if (tracks.length === 0) {
      const embed = new EmbedBuilder()
        .setDescription('No tracks found matching your query.')
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    // Add tracks to queue
    const wasEmpty = queue.tracks.length === 0;
    tracks.forEach((track) => {
      addTrack(interaction.guild!.id, track);
    });

    // If queue was empty, start playing
    if (wasEmpty) {
      // Lavalink: player.playTrack({ track: { encoded: tracks[0].encoded } });
      // Lavalink: player.setVolume(queue.volume);

      const embed = new EmbedBuilder()
        .setTitle('Now Playing')
        .setDescription(
          `**${tracks[0].info.title}**\nby ${tracks[0].info.author}`
        )
        .setColor(0x2f3136);

      return interaction.editReply({ embeds: [embed] });
    }

    // Otherwise, add to queue
    const embed = new EmbedBuilder()
      .setTitle('Track Added to Queue')
      .setDescription(
        `**${tracks[0].info.title}**\nby ${tracks[0].info.author}`
      )
      .addFields([
        {
          name: 'Position in Queue',
          value: `${queue.tracks.length}`,
          inline: true,
        },
      ])
      .setColor(0x2f3136);

    return interaction.editReply({ embeds: [embed] });
  },
};

export default command;
