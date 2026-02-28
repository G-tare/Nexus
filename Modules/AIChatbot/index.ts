import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { loadAllTools, toolRegistry } from './tools/registry';
import { DEFAULT_AICHATBOT_CONFIG } from './helpers';

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
 * AI Chatbot Module - AI-powered assistant with agent capabilities.
 * Can manage Discord servers through natural language via tool-use.
 */
export const aiChatbotModule: BotModule = {
  name: 'aichatbot',
  displayName: 'AI Chatbot',
  description: 'AI-powered assistant with agent capabilities — manage your server through natural language',
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
    // Load all Discord tools into the registry
    await loadAllTools();
    logger.info(`AI Chatbot module loaded with 5 commands and ${toolRegistry.size} agent tools`);
  },

  defaultConfig: { ...DEFAULT_AICHATBOT_CONFIG },
};

export default aiChatbotModule;
