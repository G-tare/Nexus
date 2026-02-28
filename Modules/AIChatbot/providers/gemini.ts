/**
 * Google Gemini Provider — Default free tier.
 *
 * Endpoint: generativelanguage.googleapis.com
 * Function calling: Uses `functionCall` / `functionResponse` format.
 * Free tier: 15 RPM, 1M tokens/day (Gemini Flash).
 */

import {
  AIProvider,
  ToolDefinition,
  ToolCall,
  ConversationMessage,
  CallOptions,
  ProviderResponse,
  generateToolCallId,
} from './adapter';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Gemini');

// ============================================
// Gemini-specific types
// ============================================

interface GeminiContent {
  role: 'user' | 'model' | 'function';
  parts: GeminiPart[];
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { result: string } } };

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  error?: { message: string; code: number };
}

// ============================================
// Provider Implementation
// ============================================

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
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
    const model = options.model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    // Convert messages to Gemini format
    const contents = this.convertMessages(messages);

    // Convert tools to Gemini function declarations
    const functionDeclarations = this.convertTools(tools);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
      },
    };

    // System instruction
    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    // Tools (only if we have them)
    if (functionDeclarations.length > 0) {
      body.tools = [{ functionDeclarations }];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('Gemini API error', { status: response.status, body: errText });
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as GeminiResponse;

    if (data.error) {
      throw new Error(`Gemini API error: ${data.error.message}`);
    }

    return this.parseResponse(data);
  }

  // ============================================
  // Conversion Helpers
  // ============================================

  private convertMessages(messages: ConversationMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          // Assistant message with tool calls
          const parts: GeminiPart[] = [];
          if (msg.content) parts.push({ text: msg.content });
          for (const tc of msg.toolCalls) {
            parts.push({
              functionCall: {
                name: tc.toolName,
                args: tc.parameters,
              },
            });
          }
          contents.push({ role: 'model', parts });
        } else {
          contents.push({ role: 'model', parts: [{ text: msg.content }] });
        }
      } else if (msg.role === 'tool' && msg.toolResult) {
        contents.push({
          role: 'function',
          parts: [{
            functionResponse: {
              name: msg.toolResult.toolName,
              response: { result: msg.toolResult.result },
            },
          }],
        });
      }
    }

    return contents;
  }

  private convertTools(tools: ToolDefinition[]): GeminiFunctionDeclaration[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: tool.parameters.type,
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    }));
  }

  private parseResponse(data: GeminiResponse): ProviderResponse {
    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts) {
      return {
        type: 'text',
        text: 'No response generated.',
        rawAssistantMessage: { role: 'assistant', content: 'No response generated.' },
      };
    }

    const parts = candidate.content.parts;

    // Check for function calls
    const functionCalls = parts.filter(
      (p): p is { functionCall: { name: string; args: Record<string, unknown> } } =>
        'functionCall' in p,
    );

    if (functionCalls.length > 0) {
      const toolCalls: ToolCall[] = functionCalls.map(fc => ({
        toolCallId: generateToolCallId(),
        toolName: fc.functionCall.name,
        parameters: fc.functionCall.args ?? {},
      }));

      // Collect any text parts too
      const textParts = parts
        .filter((p): p is { text: string } => 'text' in p)
        .map(p => p.text);

      return {
        type: 'tool_use',
        text: textParts.length > 0 ? textParts.join('\n') : undefined,
        toolCalls,
        rawAssistantMessage: {
          role: 'assistant',
          content: textParts.join('\n') || '',
          toolCalls,
        },
      };
    }

    // Plain text response
    const textParts = parts
      .filter((p): p is { text: string } => 'text' in p)
      .map(p => p.text);
    const text = textParts.join('\n') || 'No response generated.';

    return {
      type: 'text',
      text,
      rawAssistantMessage: { role: 'assistant', content: text },
    };
  }
}
