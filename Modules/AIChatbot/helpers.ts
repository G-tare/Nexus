import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { getDb, getRedis } from '../../Shared/src/database/connection';
import { eventBus } from '../../Shared/src/events/eventBus';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('AIChatbot');

/**
 * AI Chatbot module configuration
 */
export interface AIChatbotConfig {
  enabled: boolean;
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  maxHistory: number;
  allowedChannels: string[];
  autoReply: boolean;
  mentionReply: boolean;
  cooldown: number;
  maxMessageLength: number;
}

const DEFAULT_AICHATBOT_CONFIG: AIChatbotConfig = {
  enabled: true,
  provider: 'openai',
  apiKey: '',
  model: 'gpt-3.5-turbo',
  systemPrompt: 'You are a helpful Discord bot assistant. Keep responses concise and friendly, under 2000 characters.',
  maxTokens: 500,
  temperature: 0.7,
  maxHistory: 10,
  allowedChannels: [],
  autoReply: false,
  mentionReply: true,
  cooldown: 2,
  maxMessageLength: 2000,
};

/**
 * Get AI Chatbot config for a guild with defaults
 */
export async function getAIConfig(guildId: string): Promise<AIChatbotConfig> {
  try {
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'aichatbot');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
    return { ...DEFAULT_AICHATBOT_CONFIG, ...config };
  } catch (error) {
    logger.warn(`Failed to get AI config for guild ${guildId}, using defaults`, error);
    return DEFAULT_AICHATBOT_CONFIG;
  }
}

/**
 * Get conversation history for a channel
 */
export async function getConversationHistory(
  guildId: string,
  channelId: string,
  limit: number = 10
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
 * Add message to conversation history
 */
export async function addToHistory(
  guildId: string,
  channelId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  try {
    const redis = getRedis();
    const historyKey = `aichat:history:${guildId}:${channelId}`;
    const maxHistory = (await getAIConfig(guildId)).maxHistory;

    // Add new message
    await redis.rpush(historyKey, JSON.stringify({ role, content }));

    // Trim to max history
    await redis.ltrim(historyKey, -maxHistory, -1);

    // Set expiry to 24 hours
    await redis.expire(historyKey, 86400);
  } catch (error) {
    logger.error(`Error adding to history for ${guildId}/${channelId}`, error);
  }
}

/**
 * Clear conversation history for a channel
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

/**
 * Call OpenAI API
 */
export async function callOpenAI(
  config: AIChatbotConfig,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: config.systemPrompt },
          ...messages,
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(`OpenAI API (error as any): ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return (data as any).choices[0]?.message?.content || 'No response generated';
  } catch (error) {
    logger.error('Error calling OpenAI API', error);
    throw error;
  }
}

/**
 * Call Anthropic Claude API
 */
export async function callAnthropic(
  config: AIChatbotConfig,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        system: config.systemPrompt,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(`Anthropic API (error as any): ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return (data as any).content[0]?.text || 'No response generated';
  } catch (error) {
    logger.error('Error calling Anthropic API', error);
    throw error;
  }
}

/**
 * Generate AI response with conversation context
 */
export async function generateResponse(
  guildId: string,
  channelId: string,
  userMessage: string,
  userName: string
): Promise<string> {
  try {
    const config = await getAIConfig(guildId);

    // Get conversation history
    const history = await getConversationHistory(guildId, channelId, config.maxHistory - 1);

    // Build message array with user's new message
    const messages = [
      ...history,
      { role: 'user' as const, content: `${userName}: ${userMessage}` },
    ];

    // Call API
    let response: string;
    if (config.provider === 'openai') {
      response = await callOpenAI(config, messages);
    } else if (config.provider === 'anthropic') {
      response = await callAnthropic(config, messages);
    } else {
      throw new Error(`Unknown provider: ${config.provider}`);
    }

    // Trim to max length
    if (response.length > config.maxMessageLength) {
      response = response.substring(0, config.maxMessageLength - 3) + '...';
    }

    // Add to history
    await addToHistory(guildId, channelId, 'user', userMessage);
    await addToHistory(guildId, channelId, 'assistant', response);

    return response;
  } catch (error) {
    logger.error(`Error generating response for ${guildId}/${channelId}`, error);
    throw error;
  }
}

/**
 * Get persona/system prompt for a guild
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
 * Set persona/system prompt for a guild
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

/**
 * Check if user is on cooldown for AI commands
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
 * Set cooldown for user on AI commands
 */
export async function setAICooldown(
  guildId: string,
  userId: string,
  seconds: number
): Promise<void> {
  try {
    const redis = getRedis();
    const cooldownKey = `aichat:cooldown:${guildId}:${userId}`;
    await redis.setex(cooldownKey, seconds, '1');
  } catch (error) {
    logger.error(`Error setting AI cooldown for ${userId}`, error);
  }
}

/**
 * Approximate token count for a message (rough estimate)
 * Assumes 1 token per ~4 characters on average
 */
export function estimateTokenCount(content: string): number {
  // More accurate for English text
  return Math.ceil(content.split(/\s+/).length * 1.3);
}

/**
 * Get token usage estimate for messages
 */
export function getTokenUsage(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
): number {
  let total = estimateTokenCount(systemPrompt);
  for (const msg of messages) {
    total += estimateTokenCount(msg.content) + 4; // 4 tokens for role/metadata per message
  }
  return total;
}
