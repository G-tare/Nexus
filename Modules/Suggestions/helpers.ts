import { Guild, Message, TextChannel } from 'discord.js';
import { cache } from '../../Shared/src/cache/cacheManager';
import { moduleContainer, addText, addFields, addFooter, v2Payload } from '../../Shared/src/utils/componentsV2';
// Using global cache;

export type SuggestionStatus = 'pending' | 'approved' | 'denied' | 'considering' | 'implemented';

export interface SuggestionConfig {
  enabled: boolean;
  channelId?: string;
  anonymous: boolean;
  upvoteEmoji: string;
  downvoteEmoji: string;
  autoThread: boolean;
  requireReason: boolean;
  dmOnStatusChange: boolean;
  allowEditing: boolean;
  suggestionsCounter: number;
  embedColor: string;
  approvedColor: string;
  deniedColor: string;
  consideringColor: string;
  implementedColor: string;
}

export interface SuggestionData {
  guildId: string;
  number: number;
  userId: string;
  content: string;
  messageId: string;
  status: SuggestionStatus;
  createdAt: number;
  statusChangedAt?: number;
  staffId?: string;
  reason?: string;
  threadId?: string;
  imageUrl?: string;
}

const DEFAULT_CONFIG: SuggestionConfig = {
  enabled: true,
  anonymous: false,
  upvoteEmoji: '👍',
  downvoteEmoji: '👎',
  autoThread: true,
  requireReason: false,
  dmOnStatusChange: true,
  allowEditing: true,
  suggestionsCounter: 0,
  embedColor: '#FF9B05',
  approvedColor: '#2ECC71',
  deniedColor: '#E74C3C',
  consideringColor: '#F1C40F',
  implementedColor: '#3498DB',
};

/**
 * Get suggestion config with defaults applied
 */
export async function getSuggestionConfig(guildId: string): Promise<SuggestionConfig> {
  const key = `suggestions:config:${guildId}`;
  const data = cache.hgetall(key);

  if (!data || Object.keys(data).length === 0) {
    return { ...DEFAULT_CONFIG };
  }

  return {
    enabled: data.enabled === 'true',
    channelId: data.channelId || undefined,
    anonymous: data.anonymous === 'true',
    upvoteEmoji: data.upvoteEmoji || DEFAULT_CONFIG.upvoteEmoji,
    downvoteEmoji: data.downvoteEmoji || DEFAULT_CONFIG.downvoteEmoji,
    autoThread: data.autoThread === 'true',
    requireReason: data.requireReason === 'true',
    dmOnStatusChange: data.dmOnStatusChange === 'true',
    allowEditing: data.allowEditing === 'true',
    suggestionsCounter: parseInt(data.suggestionsCounter || '0', 10),
    embedColor: data.embedColor || DEFAULT_CONFIG.embedColor,
    approvedColor: data.approvedColor || DEFAULT_CONFIG.approvedColor,
    deniedColor: data.deniedColor || DEFAULT_CONFIG.deniedColor,
    consideringColor: data.consideringColor || DEFAULT_CONFIG.consideringColor,
    implementedColor: data.implementedColor || DEFAULT_CONFIG.implementedColor,
  };
}

/**
 * Save suggestion config to Redis
 */
export async function setSuggestionConfig(guildId: string, config: Partial<SuggestionConfig>): Promise<void> {
  const key = `suggestions:config:${guildId}`;
  const fullConfig = await getSuggestionConfig(guildId);
  const merged = { ...fullConfig, ...config };

  const data: Record<string, string> = {
    enabled: merged.enabled.toString(),
    anonymous: merged.anonymous.toString(),
    upvoteEmoji: merged.upvoteEmoji,
    downvoteEmoji: merged.downvoteEmoji,
    autoThread: merged.autoThread.toString(),
    requireReason: merged.requireReason.toString(),
    dmOnStatusChange: merged.dmOnStatusChange.toString(),
    allowEditing: merged.allowEditing.toString(),
    suggestionsCounter: merged.suggestionsCounter.toString(),
    embedColor: merged.embedColor,
    approvedColor: merged.approvedColor,
    deniedColor: merged.deniedColor,
    consideringColor: merged.consideringColor,
    implementedColor: merged.implementedColor,
  };

  if (merged.channelId) {
    data.channelId = merged.channelId;
  }

  // Set each field individually since cache.hset takes field/value pairs
  for (const [field, value] of Object.entries(data)) {
    cache.hset(key, field, value);
  }
}

/**
 * Get next suggestion number and increment counter
 */
export async function getNextSuggestionNumber(guildId: string): Promise<number> {
  const key = `suggestions:counter:${guildId}`;
  const next = cache.incr(key);
  return next;
}

/**
 * Store suggestion data in Redis
 */
export async function storeSuggestion(
  guildId: string,
  number: number,
  userId: string,
  content: string,
  messageId: string,
  imageUrl?: string,
): Promise<void> {
  const key = `suggestions:data:${guildId}:${number}`;
  const data: Record<string, string> = {
    guildId,
    number: number.toString(),
    userId,
    content,
    messageId,
    status: 'pending',
    createdAt: new Date().toString(),
  };

  if (imageUrl) {
    data.imageUrl = imageUrl;
  }

  // Set each field individually since cache.hset takes field/value pairs
  for (const [field, value] of Object.entries(data)) {
    cache.hset(key, field, value);
  }
  // Set expiry to 180 days
  cache.expire(key, 15552000);
}

/**
 * Get suggestion data from Redis
 */
export async function getSuggestionData(guildId: string, number: number): Promise<SuggestionData | null> {
  const key = `suggestions:data:${guildId}:${number}`;
  const data = cache.hgetall(key);

  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return {
    guildId: data.guildId,
    number: parseInt(data.number, 10),
    userId: data.userId,
    content: data.content,
    messageId: data.messageId,
    status: (data.status as SuggestionStatus) || 'pending',
    createdAt: parseInt(data.createdAt, 10),
    statusChangedAt: data.statusChangedAt ? parseInt(data.statusChangedAt, 10) : undefined,
    staffId: data.staffId || undefined,
    reason: data.reason || undefined,
    threadId: data.threadId || undefined,
    imageUrl: data.imageUrl || undefined,
  };
}

/**
 * Build suggestion container with status styling
 */
export function buildSuggestionEmbed(
  number: number,
  content: string,
  author: string,
  config: SuggestionConfig,
  status: SuggestionStatus = 'pending',
) {
  let statusBadge = '';

  switch (status) {
    case 'approved':
      statusBadge = ' ✅ APPROVED';
      break;
    case 'denied':
      statusBadge = ' ❌ DENIED';
      break;
    case 'considering':
      statusBadge = ' 🤔 CONSIDERING';
      break;
    case 'implemented':
      statusBadge = ' 🚀 IMPLEMENTED';
      break;
    default:
      statusBadge = ' ⏳ PENDING';
  }

  const container = moduleContainer('suggestions');
  addText(container, `### Suggestion #${number}${statusBadge}`);
  addText(container, content);
  addText(container, `**Author:** ${author === 'Anonymous' ? 'Anonymous' : author}`);
  addFooter(container, `ID: ${number}`);

  return container;
}

/**
 * Update suggestion status in Redis
 */
export async function updateSuggestionStatus(
  guildId: string,
  number: number,
  status: SuggestionStatus,
  staffId: string,
  reason?: string,
): Promise<void> {
  const key = `suggestions:data:${guildId}:${number}`;
  const updates: Record<string, string> = {
    status,
    statusChangedAt: Date.now().toString(),
    staffId,
  };

  if (reason) {
    updates.reason = reason;
  }

  // Set each field individually since cache.hset takes field/value pairs
  for (const [field, value] of Object.entries(updates)) {
    cache.hset(key, field, value);
  }
}

/**
 * Store thread ID for a suggestion
 */
export async function storeSuggestionThread(guildId: string, number: number, threadId: string): Promise<void> {
  const key = `suggestions:data:${guildId}:${number}`;
  cache.hset(key, 'threadId', threadId);
}

/**
 * Update suggestion message with new status container and reactions
 */
export async function updateSuggestionMessage(
  guild: Guild,
  suggestion: SuggestionData,
  config: SuggestionConfig,
): Promise<void> {
  if (!config.channelId) return;

  try {
    const channel = (await guild.channels.fetch(config.channelId)) as TextChannel;
    if (!channel) return;

    const message = await channel.messages.fetch(suggestion.messageId);
    if (!message) return;

    const authorUser = await guild.client.users.fetch(suggestion.userId).catch(() => null);
    const authorName = config.anonymous ? 'Anonymous' : authorUser?.username || 'Unknown User';

    const container = buildSuggestionEmbed(suggestion.number, suggestion.content, authorName, config, suggestion.status);

    if (suggestion.reason) {
      addFields(container, [
        {
          name: 'Staff Reason',
          value: suggestion.reason,
          inline: false,
        },
      ]);
    }

    await message.edit(v2Payload([container]));
  } catch (error) {
    console.error(`Failed to update suggestion message for suggestion #${suggestion.number}:`, error);
  }
}

/**
 * Add vote reactions to a message
 */
export async function addVoteReactions(message: Message, config: SuggestionConfig): Promise<void> {
  try {
    await message.react(config.upvoteEmoji);
    await message.react(config.downvoteEmoji);
  } catch (error) {
    console.error('Failed to add vote reactions:', error);
  }
}

/**
 * Delete suggestion (from storage)
 */
export async function deleteSuggestion(guildId: string, number: number): Promise<void> {
  const key = `suggestions:data:${guildId}:${number}`;
  cache.del(key);
}
