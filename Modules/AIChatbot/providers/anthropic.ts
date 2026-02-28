/**
 * Anthropic Claude Provider
 *
 * Endpoint: api.anthropic.com
 * Uses `tool_use` content blocks and `tool_result` for responses.
 */

import {
  AIProvider,
  ToolDefinition,
  ToolCall,
  ConversationMessage,
  CallOptions,
  ProviderResponse,
} from './adapter';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Anthropic');

// ============================================
// Anthropic-specific types
// ============================================

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  error?: { type: string; message: string };
}

// ============================================
// Provider Implementation
// ============================================

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async call(
    messages: ConversationMessage[],
    systemPrompt: string,
    tools: ToolDefinition[],
    options: CallOptions,
  ): Promise<ProviderResponse> {
    const url = 'https://api.anthropic.com/v1/messages';

    const anthMessages = this.convertMessages(messages);
    const anthTools = this.convertTools(tools);

    const body: Record<string, unknown> = {
      model: options.model || 'claude-sonnet-4-5-20250929',
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      messages: anthMessages,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (anthTools.length > 0) {
      body.tools = anthTools;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('Anthropic API error', { status: response.status, body: errText });
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as AnthropicResponse;

    if (data.error) {
      throw new Error(`Anthropic API error: ${data.error.message}`);
    }

    return this.parseResponse(data);
  }

  // ============================================
  // Conversion Helpers
  // ============================================

  private convertMessages(messages: ConversationMessage[]): AnthropicMessage[] {
    const out: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        out.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const blocks: AnthropicContentBlock[] = [];
          if (msg.content) {
            blocks.push({ type: 'text', text: msg.content });
          }
          for (const tc of msg.toolCalls) {
            blocks.push({
              type: 'tool_use',
              id: tc.toolCallId,
              name: tc.toolName,
              input: tc.parameters,
            });
          }
          out.push({ role: 'assistant', content: blocks });
        } else {
          out.push({ role: 'assistant', content: msg.content });
        }
      } else if (msg.role === 'tool' && msg.toolResult) {
        // Anthropic expects tool_result blocks in a 'user' message
        out.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.toolResult.toolCallId,
            content: msg.toolResult.result,
          }],
        });
      }
    }

    return out;
  }

  private convertTools(tools: ToolDefinition[]): AnthropicTool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  private parseResponse(data: AnthropicResponse): ProviderResponse {
    if (!data.content || data.content.length === 0) {
      return {
        type: 'text',
        text: 'No response generated.',
        rawAssistantMessage: { role: 'assistant', content: 'No response generated.' },
      };
    }

    // Collect text and tool_use blocks
    const textBlocks = data.content.filter(
      (b): b is { type: 'text'; text: string } => b.type === 'text',
    );
    const toolBlocks = data.content.filter(
      (b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        b.type === 'tool_use',
    );

    if (toolBlocks.length > 0) {
      const toolCalls: ToolCall[] = toolBlocks.map(tb => ({
        toolCallId: tb.id,
        toolName: tb.name,
        parameters: tb.input ?? {},
      }));

      const text = textBlocks.map(b => b.text).join('\n');

      return {
        type: 'tool_use',
        text: text || undefined,
        toolCalls,
        rawAssistantMessage: {
          role: 'assistant',
          content: text || '',
          toolCalls,
        },
      };
    }

    const text = textBlocks.map(b => b.text).join('\n') || 'No response generated.';
    return {
      type: 'text',
      text,
      rawAssistantMessage: { role: 'assistant', content: text },
    };
  }
}
