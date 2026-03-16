import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { errorContainer, warningContainer, moduleContainer, addText, addFields, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Music');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Fetch lyrics for the current or specified song')
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription('Song title and artist (optional, uses current track if not provided)')
        .setRequired(false)
    ),

  module: 'music',
  premiumFeature: 'music.advanced',
  permissionPath: 'music.lyrics',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    const query = interaction.options.getString('query');
    let searchQuery: string | null = query;

    // If no query provided, use current track
    if (!searchQuery) {
      const queue = getQueue(guildId);
      if (!queue || !queue.currentTrack) {
        await interaction.editReply(v2Payload([errorContainer('No Track', 'No song is currently playing. Provide a song title with the `/lyrics query` option.')]));
        return;
      }

      searchQuery = `${queue.currentTrack.title} ${queue.currentTrack.author}`;
    }

    try {
      // TODO: Implement lyrics API call
      // Options: Genius API, AZLyrics API, or similar
      // const lyrics = await fetchLyricsFromAPI(searchQuery);

      // Stub implementation - in production, replace with actual API call
      const lyrics = await fetchLyricsStub(searchQuery);

      if (!lyrics || !lyrics.content) {
        await interaction.editReply(v2Payload([warningContainer('Lyrics Not Found', `Could not find lyrics for **${searchQuery}**. Try a different search query.`)]));
        return;
      }

      // Split lyrics into chunks if exceeding Discord container limit
      const chunks = splitLyricsIntoChunks(lyrics.content, 4096);
      const containers: any[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const container = moduleContainer('music');
        addText(container, `### 🎵 ${lyrics.title}\n${chunks[i]}`);

        if (i === 0 && lyrics.artist) {
          addFields(container, [
            {
              name: 'Artist',
              value: lyrics.artist,
              inline: true,
            },
          ]);
        }

        if (i === 0 && lyrics.url) {
          addFields(container, [
            {
              name: 'Link',
              value: `[View on ${lyrics.source || 'Source'}](${lyrics.url})`,
              inline: true,
            },
          ]);
        }

        addFooter(container, `Page ${i + 1}/${chunks.length}${lyrics.source ? ` • Source: ${lyrics.source}` : ''}`);
        containers.push(container);
      }

      // Send first container immediately, queue others if needed
      await interaction.editReply(v2Payload([containers[0]]));

      // Send additional containers as follow-up messages if there are too many
      for (let i = 1; i < Math.min(containers.length, 5); i++) {
        await interaction.followUp(v2Payload([containers[i]]));
      }

      if (containers.length > 5) {
        const truncatedContainer = warningContainer('Lyrics Truncated', 'Only the first 5 pages are displayed. Visit the source link to see the full lyrics.');
        await interaction.followUp(v2Payload([truncatedContainer]));
      }
    } catch (error) {
      logger.error(`Error fetching lyrics for "${searchQuery}":`, error);
      await interaction.editReply(v2Payload([errorContainer('Error Fetching Lyrics', 'An error occurred while fetching the lyrics. Please try again later.')]));
    }
  },
};

/**
 * Stub function to simulate lyrics API call
 * Replace with actual API integration (Genius, AZLyrics, etc.)
 */
async function fetchLyricsStub(
  query: string
): Promise<{ title: string; artist?: string; content: string; url?: string; source?: string } | null> {
  // TODO: Implement actual lyrics API call
  // Example using Genius API:
  // const response = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(query)}`, {
  //   headers: { 'Authorization': `Bearer ${GENIUS_API_TOKEN}` }
  // });
  // const data = await response.json();
  // ... extract and return lyrics

  logger.warn(`Lyrics API not implemented - stub returning null for query: "${query}"`);
  return null;
}

/**
 * Split long lyrics into chunks that fit in Discord embeds (4096 char limit)
 */
function splitLyricsIntoChunks(lyrics: string, chunkSize: number = 4096): string[] {
  if (lyrics.length <= chunkSize) {
    return [lyrics];
  }

  const chunks: string[] = [];
  let currentChunk = '';

  const lines = lyrics.split('\n');

  for (const line of lines) {
    if ((currentChunk + line + '\n').length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // If a single line is too long, still add it
      if (line.length > chunkSize) {
        chunks.push(line);
      } else {
        currentChunk = line + '\n';
      }
    } else {
      currentChunk += line + '\n';
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export default command;
