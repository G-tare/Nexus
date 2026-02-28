/**
 * Grok (xAI) Provider
 *
 * Endpoint: api.x.ai — OpenAI-compatible format.
 * Uses same tool_calls format as OpenAI.
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

const logger = createModuleLogger('Grok');

// Reuse OpenAI types — Grok is OpenAI-compatible
interface GrokMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface GrokResponse {
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

export class GrokProvider implements AIProvider {
  readonly name = 'grok';
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
    const url = 'https://api.x.ai/v1/chat/completions';

    const grokMessages = this.convertMessages(messages, systemPrompt);
    const grokTools = tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    const body: Record<string, unknown> = {
      model: options.model || 'grok-3-mini',
      messages: grokMessages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    };

    if (grokTools.length > 0) {
      body.tools = grokTools;
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
      logger.error('Grok API error', { status: response.status, body: errText });
      throw new Error(`Grok API error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as GrokResponse;

    if (data.error) {
      throw new Error(`Grok API error: ${data.error.message}`);
    }

    return this.parseResponse(data);
  }

  private convertMessages(messages: ConversationMessage[], systemPrompt: string): GrokMessage[] {
    const out: GrokMessage[] = [];

    if (systemPrompt) {
      out.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === 'user') {
        out.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          out.push({
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
          out.push({ role: 'assistant', content: msg.content });
        }
      } else if (msg.role === 'tool' && msg.toolResult) {
        out.push({
          role: 'tool',
          content: msg.toolResult.result,
          tool_call_id: msg.toolResult.toolCallId,
        });
      }
    }

    return out;
  }

  private parseResponse(data: GrokResponse): ProviderResponse {
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
