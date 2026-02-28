import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { getRedis } from '../../Shared/src/database/connection';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { config as globalConfig } from '../../Shared/src/config';
import { decryptOrPassthrough } from '../../Shared/src/utils/encryption';

const logger = createModuleLogger('AIChatbot');

// ============================================
// Config Interface
// ============================================

export interface AIChatbotConfig {
  enabled: boolean;
  /** AI provider: groq (default free), gemini, grok, openai, anthropic */
  provider: 'gemini' | 'grok' | 'groq' | 'openai' | 'anthropic';
  /** Provider API key (overrides global DEFAULT_AI_API_KEY) */
  apiKey: string;
  /** Model name (empty = provider default) */
  model: string;
  /** Base persona / system prompt */
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  /** Max conversation history messages to include */
  maxHistory: number;
  /** Channels where the bot auto-replies to all messages */
  allowedChannels: string[];
  /** Auto-reply in allowed channels without trigger */
  autoReply: boolean;
  /** Reply when @mentioned */
  mentionReply: boolean;
  /** Per-user cooldown in seconds */
  cooldown: number;
  /** Max response length */
  maxMessageLength: number;
  /** Enable agent mode (tool-use for Discord actions) */
  agentEnabled: boolean;
  /** Trigger phrase for agent activation (e.g. "hey nexus") */
  triggerPhrase: string;
  /** Ask for confirmation before destructive actions */
  confirmDestructive: boolean;
  /** Max tool calls per message */
  maxToolCalls: number;
  /** Tool IDs to disable (e.g. ["channels.delete", "roles.delete"]) */
  disabledTools: string[];
  /** User IDs authorized to use the AI system (in addition to bot owners) */
  authorizedUsers: string[];
  /** Minutes of inactivity before conversation session expires (requires trigger phrase again) */
  conversationTimeout: number;
}

export const DEFAULT_AICHATBOT_CONFIG: AIChatbotConfig = {
  enabled: true,
  provider: 'groq',
  apiKey: '',
  model: '',
  systemPrompt: 'You are a helpful Discord bot assistant. Keep responses concise and friendly, under 2000 characters. Be conversational and match the user\'s energy.',
  maxTokens: 1024,
  temperature: 0.7,
  maxHistory: 10,
  allowedChannels: [],
  autoReply: false,
  mentionReply: true,
  cooldown: 2,
  maxMessageLength: 2000,
  agentEnabled: true,
  triggerPhrase: 'hey nexus',
  confirmDestructive: true,
  maxToolCalls: 25,
  disabledTools: [],
  authorizedUsers: [],
  conversationTimeout: 5,
};

/**
 * Check if a user is authorized to use the AI system.
 * Returns true if the user is a bot owner OR is in the guild's authorizedUsers list.
 */
export function isAIAuthorized(userId: string, config: AIChatbotConfig): boolean {
  if (globalConfig.discord.ownerIds.includes(userId)) return true;
  return config.authorizedUsers.includes(userId);
}

// ============================================
// Config Access
// ============================================

/**
 * Get AI Chatbot config for a guild with defaults.
 */
export async function getAIConfig(guildId: string): Promise<AIChatbotConfig> {
  try {
    const cfgResult = await moduleConfig.getModuleConfig(guildId, 'aichatbot');
    const config = (cfgResult?.config ?? {}) as Record<string, any>;
    const merged = { ...DEFAULT_AICHATBOT_CONFIG, ...config };

    // Transparently decrypt the API key if it was stored encrypted
    if (merged.apiKey) {
      merged.apiKey = decryptOrPassthrough(merged.apiKey);
    }

    return merged;
  } catch (error) {
    logger.warn(`Failed to get AI config for guild ${guildId}, using defaults`, error);
    return DEFAULT_AICHATBOT_CONFIG;
  }
}

// ============================================
// Conversation History
// ============================================

/**
 * Get conversation history for a channel.
 */
export async function getConversationHistory(
  guildId: string,
  channelId: string,
  limit: number = 10,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  try {
    const redis = getRedis();
    const historyKey = `aichat:history:${guildId}:${channelId}`;
    const history = await redis.lrange(historyKey, -limit, -1);
    return history.map(item => JSON.parse(item));
  } catch (error) {
    logger.error(`Error getting conversation history for ${guildId}/${channelId}`, error);
    return [];
  }
}

/**
 * Add message to conversation history.
 */
export async function addToHistory(
  guildId: string,
  channelId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<void> {
  try {
    const redis = getRedis();
    const historyKey = `aichat:history:${guildId}:${channelId}`;
    const maxHistory = (await getAIConfig(guildId)).maxHistory;

    await redis.rpush(historyKey, JSON.stringify({ role, content }));
    await redis.ltrim(historyKey, -maxHistory, -1);
    await redis.expire(historyKey, 86400);
  } catch (error) {
    logger.error(`Error adding to history for ${guildId}/${channelId}`, error);
  }
}

/**
 * Clear conversation history for a channel.
 */
export async function clearHistory(guildId: string, channelId: string): Promise<void> {
  try {
    const redis = getRedis();
    const historyKey = `aichat:history:${guildId}:${channelId}`;
    await redis.del(historyKey);
  } catch (error) {
    logger.error(`Error clearing history for ${guildId}/${channelId}`, error);
  }
}

// ============================================
// Persona
// ============================================

/**
 * Get persona/system prompt for a guild.
 */
export async function getPersona(guildId: string): Promise<string> {
  try {
    const redis = getRedis();
    const personaKey = `aichat:persona:${guildId}`;
    const persona = await redis.get(personaKey);
    return persona || (await getAIConfig(guildId)).systemPrompt;
  } catch (error) {
    logger.error(`Error getting persona for ${guildId}`, error);
    return (await getAIConfig(guildId)).systemPrompt;
  }
}

/**
 * Set persona/system prompt for a guild.
 */
export async function setPersona(guildId: string, persona: string): Promise<void> {
  try {
    const redis = getRedis();
    const personaKey = `aichat:persona:${guildId}`;
    await redis.setex(personaKey, 2592000, persona); // 30 days
  } catch (error) {
    logger.error(`Error setting persona for ${guildId}`, error);
    throw error;
  }
}

// ============================================
// Cooldown
// ============================================

/**
 * Check if user is on cooldown. Returns remaining seconds (0 = no cooldown).
 */
export async function checkAICooldown(guildId: string, userId: string): Promise<number> {
  try {
    const redis = getRedis();
    const cooldownKey = `aichat:cooldown:${guildId}:${userId}`;
    const ttl = await redis.ttl(cooldownKey);
    return ttl > 0 ? ttl : 0;
  } catch (error) {
    logger.error(`Error checking AI cooldown for ${userId}`, error);
    return 0;
  }
}

/**
 * Set cooldown for user.
 */
export async function setAICooldown(
  guildId: string,
  userId: string,
  seconds: number,
): Promise<void> {
  try {
    const redis = getRedis();
    const cooldownKey = `aichat:cooldown:${guildId}:${userId}`;
    await redis.setex(cooldownKey, seconds, '1');
  } catch (error) {
    logger.error(`Error setting AI cooldown for ${userId}`, error);
  }
}

// ============================================
// Token Estimation (kept for backwards compat)
// ============================================

export function estimateTokenCount(content: string): number {
  return Math.ceil(content.split(/\s+/).length * 1.3);
}

export function getTokenUsage(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
): number {
  let total = estimateTokenCount(systemPrompt);
  for (const msg of messages) {
    total += estimateTokenCount(msg.content) + 4;
  }
  return total;
}
