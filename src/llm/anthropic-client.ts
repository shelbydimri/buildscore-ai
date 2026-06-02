import Anthropic from '@anthropic-ai/sdk';

// ── Model IDs ─────────────────────────────────────────────────────────────────

export const MODELS = {
  OPUS:   'claude-opus-4-8',
  SONNET: 'claude-sonnet-4-6',
  HAIKU:  'claude-haiku-4-5-20251001',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

// ── Client configuration ──────────────────────────────────────────────────────

export interface ClientConfig {
  /** Retries on 429 / 529 / network errors via SDK exponential backoff. Default: 3. */
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
  messages:             Anthropic.MessageParam[];
  max_tokens:           number;
  temperature?:         number;
  /** Overrides the global timeout for this specific request. */
  timeout_ms?:          number;
  /**
   * Wraps the system prompt in an ephemeral cache_control block.
   * Set true for large, stable prompts (skill definitions) to reduce
   * latency and cost on repeated calls within the same cache TTL window.
   */
  cache_system_prompt?: boolean;
}

export interface CompletionResponse {
  text:          string;
  model:         string;
  input_tokens:  number;
  output_tokens: number;
  /** Precise SDK union — avoids stringly-typed comparisons at call sites. */
  stop_reason:   Anthropic.Message['stop_reason'];
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

/** Thrown when ANTHROPIC_API_KEY is missing or the key is rejected (401). */
export class LLMAuthError extends LLMError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, 401);
    this.name = 'LLMAuthError';
  }
}

/** Thrown after the SDK exhausts all retries on 429 / 529 responses. */
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
  private readonly sdk:    Anthropic;
  private readonly config: Required<ClientConfig>;

  private constructor(apiKey: string, config: ClientConfig) {
    this.config = {
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      timeoutMs:  config.timeoutMs  ?? DEFAULT_TIMEOUT_MS,
    };
    this.sdk = new Anthropic({
      apiKey,
      maxRetries: this.config.maxRetries,
      timeout:    this.config.timeoutMs,
    });
  }

  /**
   * Returns the shared instance. The first call sets the config;
   * subsequent calls ignore the config argument and return the existing instance.
   */
  static getInstance(config?: ClientConfig): AnthropicClient {
    if (AnthropicClient.instance) return AnthropicClient.instance;

    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new LLMAuthError('ANTHROPIC_API_KEY environment variable is not set');
    }

    AnthropicClient.instance = new AnthropicClient(apiKey, config ?? {});
    return AnthropicClient.instance;
  }

  // ── complete ──────────────────────────────────────────────────────────────

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const response = await this.sdk.messages.create(
        {
          model:       request.model,
          system:      systemParam(request),
          messages:    request.messages,
          max_tokens:  request.max_tokens,
          temperature: request.temperature,
        },
        request.timeout_ms !== undefined ? { timeout: request.timeout_ms } : undefined,
      );

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

function systemParam(
  req: CompletionRequest,
): string | Anthropic.TextBlockParam[] {
  if (!req.cache_system_prompt) return req.system;
  return [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }];
}

function mapError(err: unknown, timeoutMs: number): LLMError {
  if (err instanceof LLMError) return err;

  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new LLMTimeoutError(`Request timed out after ${timeoutMs}ms`, err);
  }

  if (err instanceof Anthropic.AuthenticationError) {
    return new LLMAuthError(
      'Authentication failed — check ANTHROPIC_API_KEY',
      err,
    );
  }

  if (err instanceof Anthropic.RateLimitError) {
    return new LLMRateLimitError(
      `Rate limit exceeded — all retries exhausted: ${err.message}`,
      err,
    );
  }

  if (err instanceof Anthropic.APIError) {
    return new LLMError(
      `Anthropic API error ${err.status}: ${err.message}`,
      err,
      err.status,
    );
  }

  return new LLMError('Unexpected error calling Anthropic API', err);
}
