/**
 * OpenAI Provider
 *
 * Endpoint: api.openai.com
 * Uses standard `tool_calls` format.
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

const logger = createModuleLogger('OpenAI');

// ============================================
// OpenAI-specific types
// ============================================

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
  error?: { message: string };
}

// ============================================
// Provider Implementation
// ============================================

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
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
    const url = 'https://api.openai.com/v1/chat/completions';

    const oaiMessages = this.convertMessages(messages, systemPrompt);
    const oaiTools = this.convertTools(tools);

    const body: Record<string, unknown> = {
      model: options.model || 'gpt-4o-mini',
      messages: oaiMessages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    };

    if (oaiTools.length > 0) {
      body.tools = oaiTools;
      body.tool_choice = 'auto';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('OpenAI API error', { status: response.status, body: errText });
      throw new Error(`OpenAI API error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as OpenAIResponse;

    if (data.error) {
      throw new Error(`OpenAI API error: ${data.error.message}`);
    }

    return this.parseResponse(data);
  }

  // ============================================
  // Conversion Helpers
  // ============================================

  private convertMessages(messages: ConversationMessage[], systemPrompt: string): OpenAIMessage[] {
    const oaiMessages: OpenAIMessage[] = [];

    if (systemPrompt) {
      oaiMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === 'user') {
        oaiMessages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          oaiMessages.push({
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.toolCalls.map(tc => ({
              id: tc.toolCallId,
              type: 'function' as const,
              function: {
                name: tc.toolName,
                arguments: JSON.stringify(tc.parameters),
              },
            })),
          });
        } else {
          oaiMessages.push({ role: 'assistant', content: msg.content });
        }
      } else if (msg.role === 'tool' && msg.toolResult) {
        oaiMessages.push({
          role: 'tool',
          content: msg.toolResult.result,
          tool_call_id: msg.toolResult.toolCallId,
        });
      }
    }

    return oaiMessages;
  }

  private convertTools(tools: ToolDefinition[]): OpenAITool[] {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private parseResponse(data: OpenAIResponse): ProviderResponse {
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message) {
      return {
        type: 'text',
        text: 'No response generated.',
        rawAssistantMessage: { role: 'assistant', content: 'No response generated.' },
      };
    }

    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCalls: ToolCall[] = message.tool_calls.map(tc => {
        let params: Record<string, unknown> = {};
        try {
          params = JSON.parse(tc.function.arguments);
        } catch {
          logger.warn('Failed to parse tool call arguments', { args: tc.function.arguments });
        }
        return {
          toolCallId: tc.id,
          toolName: tc.function.name,
          parameters: params,
        };
      });

      return {
        type: 'tool_use',
        text: message.content ?? undefined,
        toolCalls,
        rawAssistantMessage: {
          role: 'assistant',
          content: message.content ?? '',
          toolCalls,
        },
      };
    }

    const text = message.content ?? 'No response generated.';
    return {
      type: 'text',
      text,
      rawAssistantMessage: { role: 'assistant', content: text },
    };
  }
}
