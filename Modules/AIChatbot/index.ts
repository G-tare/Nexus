import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Core commands
import ask from './core/ask';
import aiclear from './core/aiclear';

// Staff commands
import aichannel from './staff/aichannel';
import aipersona from './staff/aipersona';
import aiconfig from './staff/aiconfig';

// Events
import { aiChatbotEvents } from './events';

const logger = createModuleLogger('AIChatbot');

/**
 * AI Chatbot Module - AI-powered chatbot channels and conversations
 */
export const aiChatbotModule: BotModule = {
  name: 'aichatbot',
  displayName: 'AI Chatbot',
  description: 'AI-powered chatbot with conversation history and customizable personas',
  category: 'fun',

  commands: [
    // Core commands (2)
    ask,
    aiclear,

    // Staff commands (3)
    aichannel,
    aipersona,
    aiconfig,
  ],

  events: aiChatbotEvents,

  async onLoad() {
    logger.info('AI Chatbot module loaded with 5 commands');
  },

  defaultConfig: {
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
  },
};

export default aiChatbotModule;
