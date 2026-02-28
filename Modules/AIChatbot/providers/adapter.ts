/**
 * Provider Adapter — Unified interface for AI providers with tool-use support.
 *
 * Normalizes tool definitions, tool calls, and tool results across:
 *   Gemini (Google), Grok (xAI), OpenAI, Anthropic
 *
 * All providers use raw fetch() — no SDK packages.
 */

import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('AIProvider');

// ============================================
// Core Types
// ============================================

/** JSON Schema-style parameter definition for a tool. */
export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
  minimum?: number;
  maximum?: number;
}

/** Tool definition exposed to the AI provider. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

/** A single tool call returned by the AI. */
export interface ToolCall {
  toolCallId: string;
  toolName: string;
  parameters: Record<string, unknown>;
}

/** Result of executing a tool, fed back to the AI. */
export interface ToolResult {
  toolCallId: string;
  toolName: string;
  result: string;
}

/** A message in the conversation. */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  /** Present when role === 'assistant' and the AI wants to call tools */
  toolCalls?: ToolCall[];
  /** Present when role === 'tool' */
  toolResult?: ToolResult;
}

/** Options for calling the AI provider. */
export interface CallOptions {
  model: string;
  temperature: number;
  maxTokens: number;
}

/** Response from the AI provider (normalized). */
export interface ProviderResponse {
  /** Whether the AI wants to call tools or is done (text). */
  type: 'text' | 'tool_use';
  /** Final text response (present when type === 'text'). */
  text?: string;
  /** Tool calls the AI wants to execute (present when type === 'tool_use'). */
  toolCalls?: ToolCall[];
  /** Raw conversation message to append to history for the next turn. */
  rawAssistantMessage: ConversationMessage;
}

// ============================================
// Provider Interface
// ============================================

export interface AIProvider {
  readonly name: string;

  /**
   * Call the AI provider with messages, tools, and options.
   * Returns a normalized ProviderResponse.
   */
  call(
    messages: ConversationMessage[],
    systemPrompt: string,
    tools: ToolDefinition[],
    options: CallOptions,
  ): Promise<ProviderResponse>;
}

// ============================================
// Provider Factory
// ============================================

export type ProviderName = 'gemini' | 'grok' | 'groq' | 'openai' | 'anthropic';

// Static imports — tsx doesn't reliably resolve relative dynamic imports
import { GeminiProvider } from './gemini';
import { GrokProvider } from './grok';
import { GroqProvider } from './groq';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';

/**
 * Create an AI provider instance by name.
 */
export async function createProvider(name: ProviderName, apiKey: string): Promise<AIProvider> {
  switch (name) {
    case 'gemini':
      return new GeminiProvider(apiKey);
    case 'grok':
      return new GrokProvider(apiKey);
    case 'groq':
      return new GroqProvider(apiKey);
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    default:
      throw new Error(`Unknown AI provider: ${name}`);
  }
}

// ============================================
// Helpers
// ============================================

/** Generate a unique tool call ID. */
export function generateToolCallId(): string {
  return `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Truncate a string to a max length, appending "..." if truncated. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}
