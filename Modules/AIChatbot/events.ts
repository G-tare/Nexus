import { Events, Message } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { config as globalConfig } from '../../Shared/src/config';
import { getAIConfig, checkAICooldown, setAICooldown, isAIAuthorized } from './helpers';
import { runAgent } from './agent';

const logger = createModuleLogger('AIChatbot');

// ============================================
// Trigger Detection
// ============================================

// Common greeting synonyms — if the trigger starts with one of these,
// any of the others will also match (e.g., "hi nexus" matches "hey nexus")
const GREETING_SYNONYMS = ['hey', 'hi', 'hello', 'yo', 'hiya', 'heya', 'sup'];

/**
 * Fuzzy-match a trigger phrase at the start of a message.
 * Handles typos, extra spaces, punctuation, case insensitivity, and greeting synonyms.
 * Returns the remaining message content after the trigger (empty string if just the trigger), or null if no match.
 */
function matchTrigger(content: string, triggerPhrase: string): string | null {
  const normalized = content.toLowerCase().trim();
  const trigger = triggerPhrase.toLowerCase().trim();

  if (!trigger) return null;

  // Exact prefix match (e.g., "hey nexus" or "hey nexus make a channel")
  if (normalized.startsWith(trigger)) {
    return content.substring(trigger.length).trim(); // Can be empty — that's fine
  }

  // Strip punctuation and check (e.g., "hey nexus!" → "hey nexus")
  const stripped = normalized.replace(/[^\w\s]/g, '').trim();
  if (stripped === trigger) {
    return '';
  }

  // Fuzzy: allow punctuation between words and minor typos
  // "hey, nexus" "hey nexus!" "hey nxus"
  const triggerWords = trigger.split(/\s+/);
  const contentWords = normalized.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);

  if (contentWords.length < triggerWords.length) return null;

  // Check if the first trigger word is a greeting — if so, accept any greeting synonym
  const firstTriggerIsGreeting = GREETING_SYNONYMS.includes(triggerWords[0]);

  let matches = true;
  for (let i = 0; i < triggerWords.length; i++) {
    if (!contentWords[i]) { matches = false; break; }

    // For the first word: if it's a greeting, accept any synonym
    if (i === 0 && firstTriggerIsGreeting && GREETING_SYNONYMS.includes(contentWords[i])) {
      continue;
    }

    // Allow 1 char difference for typos
    const dist = levenshteinDistance(triggerWords[i], contentWords[i]);
    if (dist > 1) { matches = false; break; }
  }

  if (matches) {
    // Just the trigger words, no extra content
    if (contentWords.length === triggerWords.length) {
      return '';
    }

    // Find where the trigger words end in the original string
    const escapedWords = triggerWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(
      `^[\\s]*${escapedWords.map(w => `[^\\w]*${w}[^\\w]*`).join('[\\s]*')}`,
      'i',
    );
    const match = content.match(pattern);
    if (match) {
      return content.substring(match[0].length).trim();
    }

    // Fallback: strip trigger word count from start
    const words = content.trim().split(/\s+/);
    return words.slice(triggerWords.length).join(' ').trim();
  }

  return null;
}

/**
 * Simple Levenshtein distance (for short words only).
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[b.length][a.length];
}

// ============================================
// Conversation Session Tracker
//
// Requires "hey nexus" (trigger phrase) for initial activation.
// After that, reply-to-bot messages keep the session alive
// within a rolling window (default 5 minutes).
// If no reply within the window, session expires and
// the trigger phrase is required again.
// ============================================

interface ConversationSession {
  lastActivity: number; // timestamp (ms)
}

// Map key: `${userId}:${channelId}`
const activeSessions = new Map<string, ConversationSession>();

// Cleanup stale sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of activeSessions) {
    // Remove sessions older than 30 minutes regardless
    if (now - session.lastActivity > 30 * 60 * 1000) {
      activeSessions.delete(key);
    }
  }
}, 600_000);

function getSessionKey(userId: string, channelId: string): string {
  return `${userId}:${channelId}`;
}

function isSessionActive(userId: string, channelId: string, timeoutMinutes: number): boolean {
  const key = getSessionKey(userId, channelId);
  const session = activeSessions.get(key);
  if (!session) return false;

  const elapsed = Date.now() - session.lastActivity;
  if (elapsed > timeoutMinutes * 60 * 1000) {
    // Session expired
    activeSessions.delete(key);
    return false;
  }

  return true;
}

function touchSession(userId: string, channelId: string): void {
  const key = getSessionKey(userId, channelId);
  activeSessions.set(key, { lastActivity: Date.now() });
}

// ============================================
// Message Handler
// ============================================

const messageCreate: ModuleEvent = {
  event: Events.MessageCreate,
  handler: async (message: Message) => {
    try {
      // Ignore bots and DMs
      if (message.author.bot) return;
      if (!message.guildId || message.channel.isDMBased()) return;

      const config = await getAIConfig(message.guildId);

      // Restricted to bot owners + authorized users
      if (!isAIAuthorized(message.author.id, config)) return;
      if (!config.enabled) return;

      // Need either a global API key or a per-server key
      const hasKey = !!(config.apiKey || globalConfig.ai.defaultApiKey);
      if (!hasKey) return;

      const clientUser = message.client.user;
      if (!clientUser) return;

      // ── Determine if we should respond ──

      const isMentioned = message.mentions.has(clientUser.id);
      const isAllowedChannel = config.allowedChannels.includes(message.channelId);

      // Check if user is replying to one of the bot's messages
      const isReplyToBot = !!(
        message.reference?.messageId &&
        message.type === 19 && // MessageType.Reply
        await (async () => {
          try {
            const repliedTo = await message.channel.messages.fetch(message.reference!.messageId!);
            return repliedTo.author.id === clientUser.id;
          } catch { return false; }
        })()
      );

      // Try trigger phrase match
      const triggerMatch = matchTrigger(message.content, config.triggerPhrase);
      const hasTrigger = triggerMatch !== null;

      // Conversation session check:
      // Reply-to-bot ONLY works if the user has an active session
      // (activated by trigger phrase within the timeout window)
      const timeoutMinutes = config.conversationTimeout ?? 5;
      const hasActiveSession = isSessionActive(message.author.id, message.channelId, timeoutMinutes);
      const replyAllowed = isReplyToBot && hasActiveSession;

      // Check all activation methods
      const shouldRespond =
        hasTrigger ||
        replyAllowed ||
        (config.mentionReply && isMentioned) ||
        (config.autoReply && isAllowedChannel);

      if (!shouldRespond) return;

      // ── Cooldown check ──

      const remainingCooldown = await checkAICooldown(message.guildId, message.author.id);
      if (remainingCooldown > 0) {
        await message.reply({
          content: `⏱️ Please wait ${remainingCooldown}s before asking again.`,
          allowedMentions: { repliedUser: false },
        }).catch(() => {});
        return;
      }

      // ── Extract user content ──

      let userContent: string;
      if (hasTrigger) {
        // Use content after trigger phrase — or "hey" greeting if empty
        userContent = triggerMatch || 'hey';
      } else if (replyAllowed) {
        // Replying to bot with active session — full message is the content
        userContent = message.content.trim() || 'hey';
      } else if (isMentioned) {
        // Strip the @mention
        userContent = message.content.replace(new RegExp(`<@!?${clientUser.id}>`, 'g'), '').trim() || 'hey';
      } else {
        // Auto-reply channel — use full message
        userContent = message.content.trim();
      }

      if (!userContent) return;

      // ── Activate / refresh conversation session ──
      touchSession(message.author.id, message.channelId);

      // ── Send typing and run agent ──

      if ('sendTyping' in message.channel) {
        await (message.channel as any).sendTyping().catch(() => {});
      }

      try {
        const result = await runAgent(message, userContent);

        if (result.response) {
          await message.reply({
            content: result.response,
            allowedMentions: { repliedUser: false },
          }).catch(() => {});
        }

        await setAICooldown(message.guildId, message.author.id, config.cooldown);

        // Log tool usage
        if (result.toolsUsed.length > 0) {
          logger.info(
            `Agent used ${result.toolsUsed.length} tools in ${result.iterations} iterations for ${message.author.username} in ${message.guild?.name}`,
            { tools: result.toolsUsed },
          );
        }
      } catch (error) {
        logger.error(`Error in AI agent for ${message.guildId}/${message.channelId}`, error);
        await message.reply({
          content: '❌ Something went wrong generating a response. Please try again later.',
          allowedMentions: { repliedUser: false },
        }).catch(() => {});
      }
    } catch (error) {
      logger.error('Error in AI MessageCreate handler', error);
    }
  },
};

export const aiChatbotEvents: ModuleEvent[] = [messageCreate];
