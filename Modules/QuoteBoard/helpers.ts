import { Message, Guild, TextChannel } from 'discord.js';
import { cache } from '../../Shared/src/cache/cacheManager';
import { moduleContainer, addText, addFields, addSectionWithThumbnail, addMediaGallery, v2Payload } from '../../Shared/src/utils/componentsV2';

export interface BoardConfig {
  enabled: boolean;
  boards: Board[];
}

export interface Board {
  id: string;
  name: string;
  emoji: string;
  channelId: string;
  threshold: number;
  selfReact: boolean;
  nsfw: boolean;
  ignoredChannels: string[];
  ignoredRoles: string[];
  color: string;
}

export interface BoardMessage {
  originalMessageId: string;
  originalChannelId: string;
  boardMessageId: string;
  boardId: string;
  guildId: string;
  authorId: string;
  reactionCount: number;
  content: string;
  attachments: string[];
  createdAt: Date;
}

const DEFAULT_BOARD_CONFIG: BoardConfig = {
  enabled: true,
  boards: [
    {
      id: 'default-starboard',
      name: 'Starboard',
      emoji: '⭐',
      channelId: '',
      threshold: 3,
      selfReact: false,
      nsfw: false,
      ignoredChannels: [],
      ignoredRoles: [],
      color: '#FFD700',
    },
  ],
};

export async function getBoardConfig(guildId: string): Promise<BoardConfig> {
  try {
    const stored = await cache.get<BoardConfig>(`quoteboard:config:${guildId}`);
    if (stored) {
      return stored;
    }
  } catch (error) {
    console.error(`Error fetching board config for ${guildId}:`, error);
  }

  return JSON.parse(JSON.stringify(DEFAULT_BOARD_CONFIG));
}

export async function saveBoardConfig(
  guildId: string,
  config: BoardConfig
): Promise<void> {
  try {
    await cache.set(
      `quoteboard:config:${guildId}`,
      config,
      86400 * 30 // 30 days
    );
  } catch (error) {
    console.error(`Error saving board config for ${guildId}:`, error);
    throw error;
  }
}

export function findBoardByEmoji(config: BoardConfig, emoji: string): Board | null {
  return config.boards.find((board) => board.emoji === emoji) || null;
}

export async function getBoardMessage(
  guildId: string,
  originalMessageId: string,
  boardId: string
): Promise<BoardMessage | null> {
  try {
    const key = `quoteboard:message:${guildId}:${boardId}:${originalMessageId}`;
    const stored = await cache.get<BoardMessage>(key);
    if (stored) {
      stored.createdAt = new Date(stored.createdAt);
      return stored;
    }
  } catch (error) {
    console.error(`Error fetching board message:`, error);
  }

  return null;
}

export async function saveBoardMessage(
  guildId: string,
  boardMessage: BoardMessage
): Promise<void> {
  try {
    const key = `quoteboard:message:${guildId}:${boardMessage.boardId}:${boardMessage.originalMessageId}`;
    await cache.set(
      key,
      boardMessage,
      86400 * 365 // 1 year
    );
  } catch (error) {
    console.error(`Error saving board message:`, error);
    throw error;
  }
}

export async function deleteBoardMessage(
  guildId: string,
  boardId: string,
  originalMessageId: string
): Promise<void> {
  try {
    const key = `quoteboard:message:${guildId}:${boardId}:${originalMessageId}`;
    await cache.del(key);
  } catch (error) {
    console.error(`Error deleting board message:`, error);
    throw error;
  }
}

export async function addToBoardChannel(
  guild: Guild,
  board: Board,
  message: Message,
  reactionCount: number
): Promise<BoardMessage | null> {
  try {
    const channel = (await guild.channels.fetch(board.channelId)) as TextChannel;
    if (!channel || !channel.isTextBased()) {
      return null;
    }

    const author = message.author;
    const container = buildBoardEmbed(message, author, board, reactionCount);

    const payload = v2Payload([container]);
    const sentMessage = await (channel as any).send(payload);

    const boardMessage: BoardMessage = {
      originalMessageId: message.id,
      originalChannelId: message.channelId,
      boardMessageId: sentMessage.id,
      boardId: board.id,
      guildId: guild.id,
      authorId: author.id,
      reactionCount,
      content: message.content,
      attachments: message.attachments.map((att) => att.url),
      createdAt: new Date(),
    };

    await saveBoardMessage(guild.id, boardMessage);
    return boardMessage;
  } catch (error) {
    console.error(`Error adding to board channel:`, error);
    return null;
  }
}

export async function updateBoardMessage(
  guild: Guild,
  board: Board,
  boardMessage: BoardMessage,
  newCount: number
): Promise<void> {
  try {
    const channel = (await guild.channels.fetch(board.channelId)) as TextChannel;
    if (!channel || !channel.isTextBased()) {
      return;
    }

    const sentMsg = await channel.messages.fetch(boardMessage.boardMessageId);
    if (!sentMsg) {
      return;
    }

    const originalChannel = (await guild.channels.fetch(
      boardMessage.originalChannelId
    )) as TextChannel;
    if (!originalChannel) {
      return;
    }

    const originalMessage = await originalChannel.messages.fetch(
      boardMessage.originalMessageId
    );
    if (!originalMessage) {
      return;
    }

    const author = originalMessage.author;
    const container = buildBoardEmbed(originalMessage, author, board, newCount);

    const payload = v2Payload([container]);
    await sentMsg.edit(payload);

    boardMessage.reactionCount = newCount;
    await saveBoardMessage(guild.id, boardMessage);
  } catch (error) {
    console.error(`Error updating board message:`, error);
  }
}

export async function removeBoardMessage(
  guild: Guild,
  board: Board,
  boardMessage: BoardMessage
): Promise<void> {
  try {
    const channel = (await guild.channels.fetch(board.channelId)) as TextChannel;
    if (!channel || !channel.isTextBased()) {
      await deleteBoardMessage(guild.id, board.id, boardMessage.originalMessageId);
      return;
    }

    try {
      const sentMsg = await channel.messages.fetch(boardMessage.boardMessageId);
      if (sentMsg) {
        await sentMsg.delete();
      }
    } catch {
      // Message already deleted
    }

    await deleteBoardMessage(guild.id, board.id, boardMessage.originalMessageId);
  } catch (error) {
    console.error(`Error removing board message:`, error);
  }
}

export async function getRandomBoardMessage(
  guildId: string,
  boardId: string
): Promise<BoardMessage | null> {
  try {
    // Cache manager doesn't provide getKeysByPrefix, so we can't enumerate cached messages
    // Return null for now
    // TODO: Maintain a separate index of board message keys or use database for querying
    return null;
  } catch (error) {
    console.error(`Error fetching random board message:`, error);
  }

  return null;
}

export interface BoardStats {
  totalMessages: number;
  mostStarredMessage: BoardMessage | null;
  topAuthors: Array<{ authorId: string; count: number }>;
}

export async function getBoardStats(
  guildId: string,
  boardId: string
): Promise<BoardStats> {
  try {
    // Cache manager doesn't provide getKeysByPrefix, so we can't enumerate cached messages
    // Return empty stats for now
    // TODO: Maintain a separate index of board message keys or use database for querying
    return {
      totalMessages: 0,
      mostStarredMessage: null,
      topAuthors: [],
    };
  } catch (error) {
    console.error(`Error fetching board stats:`, error);
    return {
      totalMessages: 0,
      mostStarredMessage: null,
      topAuthors: [],
    };
  }
}

export function buildBoardEmbed(
  message: Message,
  author: any,
  board: Board,
  reactionCount: number
) {
  const container = moduleContainer('quote_board');

  addText(container, `**${author.username}**`);

  if (message.content) {
    addText(container, message.content);
  }

  // Add images/attachments
  const images = message.attachments.filter(
    (att) => att.contentType && att.contentType.startsWith('image/')
  );
  if (images.size > 0) {
    const imageUrls = Array.from(images.values()).map((img) => ({
      url: img.url,
      description: undefined,
      spoiler: false,
    }));
    addMediaGallery(container, imageUrls);
  }

  // Add reaction count and jump link
  const jumpUrl = `https://discord.com/channels/${message.guildId!}/${message.channelId}/${message.id}`;
  addFields(container, [
    {
      name: 'Reactions',
      value: `${board.emoji} ${reactionCount}`,
      inline: true,
    },
    {
      name: 'Jump to Message',
      value: `[Click Here](${jumpUrl})`,
      inline: true,
    },
  ]);

  return container;
}
