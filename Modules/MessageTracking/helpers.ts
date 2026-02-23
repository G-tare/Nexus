import { Guild, EmbedBuilder, TextChannel, Message } from 'discord.js';
import { getRedis } from '../../Shared/src/database/connection';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('MessageTracking');

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface MessageTrackingConfig {
  enabled: boolean;
  logEdits: boolean;
  logDeletes: boolean;
  logBulkDeletes: boolean;
  ghostPingAlert: boolean;
  snipeEnabled: boolean;
  snipeTimeout: number;
  logChannelId: string | null;
  ignoredChannels: string[];
  ignoreBots: boolean;
}

export const defaultMessageTrackingConfig: MessageTrackingConfig = {
  enabled: true,
  logEdits: true,
  logDeletes: true,
  logBulkDeletes: true,
  ghostPingAlert: true,
  snipeEnabled: true,
  snipeTimeout: 300,
  logChannelId: null,
  ignoredChannels: [],
  ignoreBots: true,
};

// ── Config ──────────────────────────────────────────────────────────────────

export async function getMessageTrackingConfig(guildId: string): Promise<MessageTrackingConfig> {
  try {
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'messagetracking');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
    return { ...defaultMessageTrackingConfig, ...config };
  } catch {
    return defaultMessageTrackingConfig;
  }
}

export async function setMessageTrackingConfig(guildId: string, updates: Partial<MessageTrackingConfig>): Promise<void> {
  const current = await getMessageTrackingConfig(guildId);
  const updated = { ...current, ...updates };
  await moduleConfig.updateConfig(guildId, 'messagetracking', updated);
  logger.info(`MessageTracking config updated for guild ${guildId}`);
}

// ── Snipe Storage ───────────────────────────────────────────────────────────

export async function storeDeletedMessage(guildId: string, channelId: string, message: Message): Promise<void> {
  const redis = getRedis();
  const key = `snipe:deleted:${guildId}:${channelId}`;

  try {
    const config = await getMessageTrackingConfig(guildId);

    const messageData = {
      authorId: message.author.id,
      authorName: message.author.username,
      authorAvatar: message.author.displayAvatarURL({ size: 256 }),
      content: message.content,
      embeds: message.embeds.map((e) => e.toJSON()),
      attachments: message.attachments.map((a) => ({
        name: a.name,
        url: a.url,
        size: a.size,
        proxyURL: a.proxyURL,
      })),
      timestamp: message.createdTimestamp,
      deletedAt: Date.now(),
    };

    await redis.setex(key, config.snipeTimeout, JSON.stringify(messageData));
  } catch (error) {
    logger.error(`Failed to store deleted message for snipe in ${guildId}:${channelId}:`, error);
  }
}

export async function storeEditedMessage(guildId: string, channelId: string, oldMessage: Message, newMessage: Message): Promise<void> {
  const redis = getRedis();
  const key = `snipe:edited:${guildId}:${channelId}`;

  try {
    const config = await getMessageTrackingConfig(guildId);

    const editData = {
      authorId: newMessage.author.id,
      authorName: newMessage.author.username,
      authorAvatar: newMessage.author.displayAvatarURL({ size: 256 }),
      oldContent: oldMessage.content,
      newContent: newMessage.content,
      oldEmbeds: oldMessage.embeds.map((e) => e.toJSON()),
      newEmbeds: newMessage.embeds.map((e) => e.toJSON()),
      createdAt: newMessage.createdTimestamp,
      editedAt: newMessage.editedTimestamp || Date.now(),
    };

    await redis.setex(key, config.snipeTimeout, JSON.stringify(editData));
  } catch (error) {
    logger.error(`Failed to store edited message for editsnipe in ${guildId}:${channelId}:`, error);
  }
}

export async function getLastDeletedMessage(guildId: string, channelId: string): Promise<any | null> {
  const redis = getRedis();
  const key = `snipe:deleted:${guildId}:${channelId}`;

  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Failed to retrieve deleted message for snipe:`, error);
    return null;
  }
}

export async function getLastEditedMessage(guildId: string, channelId: string): Promise<any | null> {
  const redis = getRedis();
  const key = `snipe:edited:${guildId}:${channelId}`;

  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Failed to retrieve edited message for editsnipe:`, error);
    return null;
  }
}

// ── Ghost Ping Detection ────────────────────────────────────────────────────

export function checkGhostPing(message: Message): {
  hasMentions: boolean;
  mentions: Array<{ id: string; name: string; type: 'user' | 'role' }>;
} {
  const mentions: Array<{ id: string; name: string; type: 'user' | 'role' }> = [];

  message.mentions.users.forEach((user) => {
    mentions.push({ id: user.id, name: user.username, type: 'user' });
  });

  message.mentions.roles.forEach((role) => {
    mentions.push({ id: role.id, name: role.name, type: 'role' });
  });

  return { hasMentions: mentions.length > 0, mentions };
}

// ── Logging ─────────────────────────────────────────────────────────────────

export async function logToChannel(guild: Guild, embed: EmbedBuilder): Promise<void> {
  try {
    const config = await getMessageTrackingConfig(guild.id);
    if (!config.logChannelId) return;

    const logChannel = await guild.channels.fetch(config.logChannelId);
    if (!logChannel || !logChannel.isTextBased()) {
      logger.warn(`Invalid log channel configured for guild ${guild.id}: ${config.logChannelId}`);
      return;
    }

    await (logChannel as TextChannel).send({ embeds: [embed] });
  } catch (error) {
    logger.error(`Failed to log to channel in guild ${guild.id}:`, error);
  }
}

export async function shouldIgnoreChannel(guildId: string, channelId: string): Promise<boolean> {
  const config = await getMessageTrackingConfig(guildId);
  return config.ignoredChannels.includes(channelId);
}
