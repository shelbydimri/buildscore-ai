import Groq from 'groq-sdk';

// ── Model IDs ─────────────────────────────────────────────────────────────────

export const MODELS = {
  OPUS:   'llama-3.3-70b-versatile',
  SONNET: 'llama-3.3-70b-versatile',
  HAIKU:  'llama-3.3-70b-versatile',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

// ── Client configuration ──────────────────────────────────────────────────────

export interface ClientConfig {
  /** Retries on network errors via SDK exponential backoff. Default: 3. */
  maxRetries?: number;
  /** Global per-request timeout in milliseconds. Default: 120_000 (2 min). */
  timeoutMs?:  number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS  = 120_000;

// ── Request / response types ──────────────────────────────────────────────────

export interface CompletionRequest {
  model:                ModelId;
  system:               string;
  messages:             Groq.Chat.ChatCompletionMessageParam[];
  max_tokens:           number;
  temperature?:         number;
  /** Overrides the global timeout for this specific request. */
  timeout_ms?:          number;
  /**
   * Cache control (kept for API compatibility, not used by Groq).
   */
  cache_system_prompt?: boolean;
}

export interface CompletionResponse {
  text:          string;
  model:         string;
  input_tokens:  number;
  output_tokens: number;
  stop_reason:   string;
}

// ── Error hierarchy ───────────────────────────────────────────────────────────

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

/** Thrown when GROQ_API_KEY is missing or the key is rejected (401). */
export class LLMAuthError extends LLMError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, 401);
    this.name = 'LLMAuthError';
  }
}

/** Thrown after the SDK exhausts all retries on rate limit responses. */
export class LLMRateLimitError extends LLMError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, 429);
    this.name = 'LLMRateLimitError';
  }
}

/** Thrown when the request exceeds the configured or per-request timeout. */
export class LLMTimeoutError extends LLMError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, 408);
    this.name = 'LLMTimeoutError';
  }
}

// ── Singleton client ──────────────────────────────────────────────────────────

export class AnthropicClient {
  private static instance: AnthropicClient | null = null;
  private readonly sdk:    Groq;
  private readonly config: Required<ClientConfig>;

  private constructor(apiKey: string, config: ClientConfig) {
    this.config = {
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      timeoutMs:  config.timeoutMs  ?? DEFAULT_TIMEOUT_MS,
    };
    this.sdk = new Groq({
      apiKey,
      timeout: this.config.timeoutMs,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Returns the shared instance. The first call sets the config;
   * subsequent calls ignore the config argument and return the existing instance.
   */
  static getInstance(config?: ClientConfig): AnthropicClient {
    if (AnthropicClient.instance) return AnthropicClient.instance;

    const apiKey = process.env['GROQ_API_KEY'];
    if (!apiKey) {
      throw new LLMAuthError('GROQ_API_KEY environment variable is not set');
    }

    AnthropicClient.instance = new AnthropicClient(apiKey, config ?? {});
    return AnthropicClient.instance;
  }

  // ── complete ──────────────────────────────────────────────────────────────

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      // Groq expects system as part of messages array, not separate parameter
      const messages: Groq.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: request.system },
        ...request.messages,
      ];

      const response = await this.sdk.chat.completions.create({
        model:       request.model,
        messages:    messages,
        max_tokens:  request.max_tokens,
        temperature: request.temperature,
      });

      const choice = response.choices[0];
      if (!choice || choice.message.role !== 'assistant' || !choice.message.content) {
        throw new LLMError('API response contained no assistant message', response);
      }

      return {
        text:          choice.message.content,
        model:         response.model,
        input_tokens:  response.usage.prompt_tokens,
        output_tokens: response.usage.completion_tokens,
        stop_reason:   choice.finish_reason || 'unknown',
      };
    } catch (err) {
      console.error('[Groq] Error:', err instanceof Error ? err.message : err);
      throw mapError(err, this.config.timeoutMs);
    }
  }

  // ── completeJSON ──────────────────────────────────────────────────────────

  async completeJSON<T>(request: CompletionRequest): Promise<T> {
    const response = await this.complete(request);

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch (parseError) {
      throw new LLMError(
        'API response was not valid JSON — ensure the prompt instructs the model to output raw JSON only',
        { response, parseError },
      );
    }

    return parsed as T;
  }

  // ── Test utility ──────────────────────────────────────────────────────────
  // Clears the singleton between tests so each test starts with a clean slate.

  static _reset(): void {
    AnthropicClient.instance = null;
  }
}

// ── Module-level helpers ──────────────────────────────────────────────────────

function mapError(err: unknown, timeoutMs: number): LLMError {
  if (err instanceof LLMError) return err;

  // Check for Groq-specific errors
  if (err instanceof Groq.APIConnectionTimeoutError) {
    return new LLMTimeoutError(`Request timed out after ${timeoutMs}ms`, err);
  }

  if (err instanceof Groq.AuthenticationError) {
    return new LLMAuthError(
      'Authentication failed — check GROQ_API_KEY',
      err,
    );
  }

  if (err instanceof Groq.RateLimitError) {
    return new LLMRateLimitError(
      `Rate limit exceeded: ${err.message}`,
      err,
    );
  }

  if (err instanceof Groq.APIError) {
    return new LLMError(
      `Groq API error ${err.status}: ${err.message}`,
      err,
      err.status,
    );
  }

  return new LLMError(`Groq API error: ${err instanceof Error ? err.message : String(err)}`, err);
}
