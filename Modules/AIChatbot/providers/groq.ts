/**
 * Groq Provider — Fast inference for open-source models (Llama, Mixtral, etc.)
 *
 * Endpoint: api.groq.com — OpenAI-compatible format.
 * Free tier: 30 RPM, 14,400 RPD for most models.
 * Default model: llama-3.3-70b-versatile
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

const logger = createModuleLogger('Groq');

interface GroqMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface GroqResponse {
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

export class GroqProvider implements AIProvider {
  readonly name = 'groq';
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
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const groqMessages = this.convertMessages(messages, systemPrompt);
    const groqTools = tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    const body: Record<string, unknown> = {
      model: options.model || 'llama-3.3-70b-versatile',
      messages: groqMessages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    };

    if (groqTools.length > 0) {
      body.tools = groqTools;
      body.tool_choice = 'auto';
    }

    // Retry logic for 429 rate limits — Groq tells us exactly how long to wait
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429 && attempt < maxRetries) {
        // Parse retry-after from headers or error body
        const retryAfterHeader = response.headers.get('retry-after');
        let waitMs = 5000; // Default 5s

        if (retryAfterHeader) {
          waitMs = Math.ceil(parseFloat(retryAfterHeader) * 1000);
        } else {
          // Try to extract wait time from error body: "Please try again in 4.445s"
          try {
            const errBody = await response.text();
            const match = errBody.match(/try again in (\d+\.?\d*)s/);
            if (match) {
              waitMs = Math.ceil(parseFloat(match[1]) * 1000);
            }
          } catch { /* use default */ }
        }

        // Cap wait at 15s — don't hold up the bot forever
        waitMs = Math.min(waitMs + 500, 15_000); // +500ms buffer
        logger.warn(`Groq rate limited, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        logger.error('Groq API error', { status: response.status, body: errText });
        throw new Error(`Groq API error ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as GroqResponse;

      if (data.error) {
        throw new Error(`Groq API error: ${data.error.message}`);
      }

      return this.parseResponse(data);
    }

    // Should never reach here, but just in case
    throw new Error('Groq API: max retries exceeded');
  }

  private convertMessages(messages: ConversationMessage[], systemPrompt: string): GroqMessage[] {
    const out: GroqMessage[] = [];

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

  private parseResponse(data: GroqResponse): ProviderResponse {
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
