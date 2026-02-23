import { Message, Guild, TextChannel, EmbedBuilder, APIEmbedField } from 'discord.js';
import { getRedis } from '../../Shared/src/database/connection';

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
    const redis = await getRedis();
    const stored = await redis.get(`quoteboard:config:${guildId}`);
    if (stored) {
      return JSON.parse(stored);
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
    const redis = await getRedis();
    await redis.set(
      `quoteboard:config:${guildId}`,
      JSON.stringify(config),
      'EX',
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
    const redis = await getRedis();
    const key = `quoteboard:message:${guildId}:${boardId}:${originalMessageId}`;
    const stored = await redis.get(key);
    if (stored) {
      const data = JSON.parse(stored);
      data.createdAt = new Date(data.createdAt);
      return data;
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
    const redis = await getRedis();
    const key = `quoteboard:message:${guildId}:${boardMessage.boardId}:${boardMessage.originalMessageId}`;
    await redis.set(
      key,
      JSON.stringify(boardMessage),
      'EX',
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
    const redis = await getRedis();
    const key = `quoteboard:message:${guildId}:${boardId}:${originalMessageId}`;
    await redis.del(key);
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
    const embed = buildBoardEmbed(message, author, board, reactionCount);

    const sentMessage = await (channel as any).send({ embeds: [embed] });

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
    const embed = buildBoardEmbed(originalMessage, author, board, newCount);

    await sentMsg.edit({ embeds: [embed] });

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
    const redis = await getRedis();
    const pattern = `quoteboard:message:${guildId}:${boardId}:*`;
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      return null;
    }

    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const stored = await redis.get(randomKey);
    if (stored) {
      const data = JSON.parse(stored);
      data.createdAt = new Date(data.createdAt);
      return data;
    }
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
    const redis = await getRedis();
    const pattern = `quoteboard:message:${guildId}:${boardId}:*`;
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      return {
        totalMessages: 0,
        mostStarredMessage: null,
        topAuthors: [],
      };
    }

    const messages: BoardMessage[] = [];
    for (const key of keys) {
      const stored = await redis.get(key);
      if (stored) {
        const data = JSON.parse(stored);
        data.createdAt = new Date(data.createdAt);
        messages.push(data);
      }
    }

    messages.sort((a, b) => b.reactionCount - a.reactionCount);
    const mostStarred = messages[0] || null;

    const authorCounts: { [key: string]: number } = {};
    messages.forEach((msg) => {
      authorCounts[msg.authorId] = (authorCounts[msg.authorId] || 0) + 1;
    });

    const topAuthors = Object.entries(authorCounts)
      .map(([authorId, count]) => ({ authorId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalMessages: messages.length,
      mostStarredMessage: mostStarred,
      topAuthors,
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
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: author.username,
      iconURL: author.displayAvatarURL(),
    })
    .setColor(board.color as any)
    .setTimestamp(message.createdTimestamp);

  if (message.content) {
    embed.setDescription(message.content);
  }

  // Add images/attachments
  const images = message.attachments.filter(
    (att) => att.contentType && att.contentType.startsWith('image/')
  );
  if (images.size > 0) {
    const firstImage = images.first();
    if (firstImage) {
      embed.setImage(firstImage.url);
    }
  }

  // Add reaction count field
  embed.addFields({
    name: 'Reactions',
    value: `${board.emoji} ${reactionCount}`,
    inline: true,
  });

  // Add jump link
  const jumpUrl = `https://discord.com/channels/${message.guildId!}/${message.channelId}/${message.id}`;
  embed.addFields({
    name: 'Jump to Message',
    value: `[Click Here](${jumpUrl})`,
    inline: true,
  });

  return embed;
}
