import Anthropic from '@anthropic-ai/sdk';

// ── Model IDs ─────────────────────────────────────────────────────────────────

export const MODELS = {
  OPUS:   'claude-opus-4-8',
  SONNET: 'claude-sonnet-4-6',
  HAIKU:  'claude-haiku-4-5-20251001',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

// ── Request / response contracts ──────────────────────────────────────────────

export interface CompletionRequest {
  model:      ModelId;
  system:     string;
  messages:   Anthropic.MessageParam[];
  max_tokens: number;
  temperature?: number;
  /**
   * When true, sends the system prompt as an ephemeral cache_control block.
   * Set for large, stable prompts (skill definitions) to reduce latency and cost.
   */
  cache_system_prompt?: boolean;
}

export interface CompletionResponse {
  text:          string;
  model:         string;
  input_tokens:  number;
  output_tokens: number;
  stop_reason:   string | null;
}

// ── Error ─────────────────────────────────────────────────────────────────────

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

// ── Singleton client ──────────────────────────────────────────────────────────

export class AnthropicClient {
  private static instance: AnthropicClient | null = null;
  private readonly sdk: Anthropic;

  private constructor(apiKey: string) {
    this.sdk = new Anthropic({ apiKey });
  }

  static getInstance(): AnthropicClient {
    if (AnthropicClient.instance) return AnthropicClient.instance;

    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new LLMError('ANTHROPIC_API_KEY environment variable is not set');
    }

    AnthropicClient.instance = new AnthropicClient(apiKey);
    return AnthropicClient.instance;
  }

  // ── complete ──────────────────────────────────────────────────────────────

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const system: string | Anthropic.TextBlockParam[] =
      request.cache_system_prompt
        ? [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }]
        : request.system;

    try {
      const response = await this.sdk.messages.create({
        model:      request.model,
        system,
        messages:   request.messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
      });

      const block = response.content.find(b => b.type === 'text');
      if (!block || block.type !== 'text') {
        throw new LLMError('API response contained no text block', response);
      }

      return {
        text:          block.text,
        model:         response.model,
        input_tokens:  response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        stop_reason:   response.stop_reason,
      };
    } catch (err) {
      if (err instanceof LLMError) throw err;
      if (err instanceof Anthropic.APIError) {
        throw new LLMError(
          `Anthropic API error ${err.status}: ${err.message}`,
          err,
          err.status,
        );
      }
      throw new LLMError('Unexpected error calling Anthropic API', err);
    }
  }

  // ── completeJSON ──────────────────────────────────────────────────────────

  async completeJSON<T>(request: CompletionRequest): Promise<T> {
    const response = await this.complete(request);

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch (err) {
      throw new LLMError(
        'API response was not valid JSON — ensure the prompt instructs the model to output raw JSON only',
        { raw: response.text, parseError: err },
      );
    }

    return parsed as T;
  }

  // ── test utility ──────────────────────────────────────────────────────────
  // Clears the singleton so tests can inject a fresh client or env state.

  static _reset(): void {
    AnthropicClient.instance = null;
  }
}
