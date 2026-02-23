import {
  Guild,
  GuildMember,
  EmbedBuilder,
  TextChannel,
  Message,
  AuditLogEvent,
  User,
  Channel,
  Role,
  ColorResolvable,
} from 'discord.js';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { getRedis, getDb } from '../../Shared/src/database/connection';
import { Colors } from '../../Shared/src/utils/embed';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Logging');

// ============================================================================
// Types & Constants
// ============================================================================

export type LogEventType =
  // Messages
  | 'messageEdit'
  | 'messageDelete'
  | 'messageBulkDelete'
  | 'messagePin'
  // Members
  | 'memberJoin'
  | 'memberLeave'
  | 'memberRoleChange'
  | 'memberNicknameChange'
  | 'memberTimeout'
  // Channels
  | 'channelCreate'
  | 'channelDelete'
  | 'channelUpdate'
  // Roles
  | 'roleCreate'
  | 'roleDelete'
  | 'roleUpdate'
  // Server
  | 'serverUpdate'
  | 'emojiUpdate'
  | 'stickerUpdate'
  // Voice
  | 'voiceJoin'
  | 'voiceLeave'
  | 'voiceMove'
  | 'voiceMute'
  | 'voiceDeafen'
  // Moderation
  | 'memberBan'
  | 'memberUnban'
  | 'memberKick'
  // Invites
  | 'inviteCreate'
  | 'inviteDelete'
  // Threads
  | 'threadCreate'
  | 'threadDelete'
  | 'threadArchive';

export interface LoggingConfig {
  enabled: boolean;
  defaultChannelId?: string;
  channelMap: Partial<Record<LogEventType, string>>;
  enabledEvents: Record<LogEventType, boolean>;
  ignoredChannels: string[];
  ignoredRoles: string[];
  ignoredUsers: string[];
}

export const ALL_LOG_EVENT_TYPES: LogEventType[] = [
  'messageEdit',
  'messageDelete',
  'messageBulkDelete',
  'messagePin',
  'memberJoin',
  'memberLeave',
  'memberRoleChange',
  'memberNicknameChange',
  'memberTimeout',
  'channelCreate',
  'channelDelete',
  'channelUpdate',
  'roleCreate',
  'roleDelete',
  'roleUpdate',
  'serverUpdate',
  'emojiUpdate',
  'stickerUpdate',
  'voiceJoin',
  'voiceLeave',
  'voiceMove',
  'voiceMute',
  'voiceDeafen',
  'memberBan',
  'memberUnban',
  'memberKick',
  'inviteCreate',
  'inviteDelete',
  'threadCreate',
  'threadDelete',
  'threadArchive',
];

export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  enabled: true,
  channelMap: {},
  enabledEvents: ALL_LOG_EVENT_TYPES.reduce(
    (acc, eventType) => {
      acc[eventType] = true;
      return acc;
    },
    {} as Record<LogEventType, boolean>
  ),
  ignoredChannels: [],
  ignoredRoles: [],
  ignoredUsers: [],
};

// ============================================================================
// Main Helper Functions
// ============================================================================

/**
 * Get the logging config for a guild with defaults applied
 */
export async function getLoggingConfig(guildId: string): Promise<LoggingConfig> {
  try {
    const _storedCfgResult = await moduleConfig.getModuleConfig(guildId, 'logging');
  const _storedCfg = (_storedCfgResult?.config ?? {}) as Record<string, any>;
    const stored = (_storedCfg?.config ?? {}) as any;
    if (!stored) {
      return { ...DEFAULT_LOGGING_CONFIG };
    }

    // Merge with defaults to ensure missing fields are filled
    return {
      enabled: stored.enabled ?? DEFAULT_LOGGING_CONFIG.enabled,
      defaultChannelId: stored.defaultChannelId,
      channelMap: stored.channelMap ?? {},
      enabledEvents: {
        ...DEFAULT_LOGGING_CONFIG.enabledEvents,
        ...(stored.enabledEvents ?? {}),
      },
      ignoredChannels: stored.ignoredChannels ?? [],
      ignoredRoles: stored.ignoredRoles ?? [],
      ignoredUsers: stored.ignoredUsers ?? [],
    };
  } catch (error) {
    logger.error(`Failed to get logging config for guild ${guildId}:`, error);
    return { ...DEFAULT_LOGGING_CONFIG };
  }
}

/**
 * Check if an event type is enabled in config
 */
export function isEventEnabled(config: LoggingConfig, eventType: LogEventType): boolean {
  if (!config.enabled) {
    return false;
  }
  return config.enabledEvents[eventType] !== false;
}

/**
 * Get the log channel for a specific event type
 * First checks channelMap[eventType], then falls back to defaultChannelId
 */
export async function getLogChannel(
  guild: Guild,
  config: LoggingConfig,
  eventType: LogEventType
): Promise<TextChannel | null> {
  try {
    // Check specific channel for this event type
    const specificChannelId = config.channelMap[eventType];
    if (specificChannelId) {
      const channel = await guild.channels.fetch(specificChannelId);
      if (channel && channel.isTextBased()) {
        return channel as TextChannel;
      }
    }

    // Fall back to default channel
    if (config.defaultChannelId) {
      const channel = await guild.channels.fetch(config.defaultChannelId);
      if (channel && channel.isTextBased()) {
        return channel as TextChannel;
      }
    }

    return null;
  } catch (error) {
    logger.warn(`Failed to get log channel for event ${eventType}:`, error);
    return null;
  }
}

/**
 * Check if a source should be ignored for logging
 */
export function isIgnored(
  config: LoggingConfig,
  ignoreType: 'user' | 'channel' | 'role',
  value?: string | string[]
): boolean {
  // Handle user ignore list
  if (ignoreType === 'user' && value) {
    const userId = typeof value === 'string' ? value : value[0];
    if (userId && config.ignoredUsers.includes(userId)) {
      return true;
    }
  }

  // Check channel ignore list
  if (ignoreType === 'channel' && value) {
    const channelId = typeof value === 'string' ? value : value[0];
    if (channelId && config.ignoredChannels.includes(channelId)) {
      return true;
    }
  }

  // Check role ignore list
  if (ignoreType === 'role' && value) {
    const roleIds = Array.isArray(value) ? value : [value];
    if (roleIds.some((roleId) => config.ignoredRoles.includes(roleId))) {
      return true;
    }
  }

  return false;
}

/**
 * Send a log embed to the appropriate channel for an event
 */
export async function sendLogEmbed(
  guild: Guild,
  embed: EmbedBuilder,
  config: LoggingConfig,
  eventType: LogEventType
): Promise<void> {
  try {
    if (!isEventEnabled(config, eventType)) {
      return;
    }

    const channel = await getLogChannel(guild, config, eventType);
    if (!channel) {
      logger.debug(`No log channel configured for event type ${eventType} in guild ${guild.id}`);
      return;
    }

    // Add title and timestamp if not already present
    if (!embed.data.title) {
      embed.setTitle(logEventTypeDisplayName(eventType));
    }
    if (!embed.data.timestamp) {
      embed.setTimestamp();
    }

    await (channel as any).send({ embeds: [embed] });
  } catch (error) {
    logger.error(`Failed to send log embed for event ${eventType}:`, error);
  }
}

// ============================================================================
// Text Formatting Utilities
// ============================================================================

/**
 * Truncate text with ellipsis if it exceeds max length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format a before/after diff for embed display
 */
export function formatDiff(label: string, before: string | null, after: string | null): string {
  let result = `**${label}:**\n`;

  if (before !== null && after !== null) {
    result += `◀ ${before}\n`;
    result += `▶ ${after}`;
  } else if (before !== null) {
    result += `◀ ${before}`;
  } else if (after !== null) {
    result += `▶ ${after}`;
  }

  return result;
}

// ============================================================================
// Embed Builders
// ============================================================================

/**
 * Build an embed for a deleted message
 */
export function buildMessageDeleteEmbed(
  message: Message | { content: string; author: { username: string; id: string }; channel: { id: string }; createdAt: Date }
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(Colors.Error)
    .addFields({
      name: 'Author',
      value: `${message.author.username} (${message.author.id})`,
      inline: false,
    })
    .addFields({
      name: 'Channel',
      value: `<#${message.channel.id}>`,
      inline: false,
    });

  if (message.content) {
    embed.addFields({
      name: 'Content',
      value: truncateText(message.content, 1024) || '*No content*',
      inline: false,
    });
  }

  if ('attachments' in message && message.attachments.size > 0) {
    const attachmentList = message.attachments
      .map((att) => `[${att.name}](${att.url})`)
      .join('\n');
    embed.addFields({
      name: `Attachments (${message.attachments.size})`,
      value: truncateText(attachmentList, 1024),
      inline: false,
    });
  }

  embed.setTimestamp(message.createdAt);

  return embed;
}

/**
 * Build an embed for bulk deleted messages
 */
export function buildBulkDeleteEmbed(
  messages: Array<{ content: string; author: { username: string } }>,
  channelId: string,
  channelName: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(Colors.Error)
    .addFields({
      name: 'Channel',
      value: `${channelName} (<#${channelId}>)`,
      inline: false,
    })
    .addFields({
      name: 'Messages Deleted',
      value: String(messages.length),
      inline: true,
    });

  // Format messages for display
  let messageText = '';
  let truncatedCount = 0;

  for (const msg of messages) {
    const line = `**${msg.author.username}**: ${msg.content}\n`;

    // Check if adding this line would exceed limits
    if (messageText.length + line.length > 4000) {
      truncatedCount = messages.length - messages.indexOf(msg);
      break;
    }

    messageText += line;
  }

  if (messageText) {
    embed.setDescription(truncateText(messageText, 4096));
  }

  if (truncatedCount > 0) {
    embed.addFields({
      name: 'Truncated',
      value: `... and ${truncatedCount} more messages`,
      inline: false,
    });
  }

  embed.setTimestamp();

  return embed;
}

/**
 * Build an embed for an edited message
 */
export function buildMessageEditEmbed(oldMessage: Message, newMessage: Message, config: LoggingConfig): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(getLogColor('messageEdit'))
    .addFields({
      name: 'Author',
      value: `${newMessage.author.username} (${newMessage.author.id})`,
      inline: false,
    })
    .addFields({
      name: 'Channel',
      value: `<#${newMessage.channelId}> [Jump to message](${newMessage.url})`,
      inline: false,
    });

  const beforeContent = oldMessage.content || '*No content*';
  const afterContent = newMessage.content || '*No content*';

  embed.addFields({
    name: 'Content Changed',
    value: formatDiff('Content', beforeContent, afterContent),
    inline: false,
  });

  embed.setTimestamp(newMessage.editedAt || newMessage.createdAt);

  return embed;
}

// ============================================================================
// Display Utilities
// ============================================================================

/**
 * Get human-readable display name for a log event type
 */
export function logEventTypeDisplayName(eventType: LogEventType): string {
  const displayNames: Record<LogEventType, string> = {
    messageEdit: 'Message Edit',
    messageDelete: 'Message Delete',
    messageBulkDelete: 'Bulk Message Delete',
    messagePin: 'Message Pin',
    memberJoin: 'Member Join',
    memberLeave: 'Member Leave',
    memberRoleChange: 'Member Role Change',
    memberNicknameChange: 'Member Nickname Change',
    memberTimeout: 'Member Timeout',
    channelCreate: 'Channel Create',
    channelDelete: 'Channel Delete',
    channelUpdate: 'Channel Update',
    roleCreate: 'Role Create',
    roleDelete: 'Role Delete',
    roleUpdate: 'Role Update',
    serverUpdate: 'Server Update',
    emojiUpdate: 'Emoji Update',
    stickerUpdate: 'Sticker Update',
    voiceJoin: 'Voice Join',
    voiceLeave: 'Voice Leave',
    voiceMove: 'Voice Move',
    voiceMute: 'Voice Mute',
    voiceDeafen: 'Voice Deafen',
    memberBan: 'Member Ban',
    memberUnban: 'Member Unban',
    memberKick: 'Member Kick',
    inviteCreate: 'Invite Create',
    inviteDelete: 'Invite Delete',
    threadCreate: 'Thread Create',
    threadDelete: 'Thread Delete',
    threadArchive: 'Thread Archive',
  };

  return displayNames[eventType] || eventType;
}

/**
 * Get the appropriate color for an event type
 */
export function getLogColor(eventType: LogEventType): ColorResolvable {
  // Message events: Orange
  if (['messageEdit', 'messageDelete', 'messageBulkDelete', 'messagePin'].includes(eventType)) {
    return Colors.Warning;
  }

  // Member events: Blue
  if (
    [
      'memberJoin',
      'memberLeave',
      'memberRoleChange',
      'memberNicknameChange',
      'memberTimeout',
    ].includes(eventType)
  ) {
    return Colors.Primary;
  }

  // Channel events: Purple
  if (['channelCreate', 'channelDelete', 'channelUpdate'].includes(eventType)) {
    return 0x9b59b6;
  }

  // Role events: Cyan
  if (['roleCreate', 'roleDelete', 'roleUpdate'].includes(eventType)) {
    return 0x1abc9c;
  }

  // Server events: Gold
  if (['serverUpdate', 'emojiUpdate', 'stickerUpdate'].includes(eventType)) {
    return 0xf1c40f;
  }

  // Voice events: Green
  if (['voiceJoin', 'voiceLeave', 'voiceMove', 'voiceMute', 'voiceDeafen'].includes(eventType)) {
    return Colors.Success;
  }

  // Moderation events: Red
  if (['memberBan', 'memberUnban', 'memberKick'].includes(eventType)) {
    return Colors.Error;
  }

  // Invite events: Teal
  if (['inviteCreate', 'inviteDelete'].includes(eventType)) {
    return 0x17a2b8;
  }

  // Thread events: Indigo
  if (['threadCreate', 'threadDelete', 'threadArchive'].includes(eventType)) {
    return 0x4f46e5;
  }

  // Default to gray
  return 0x808080;
}
