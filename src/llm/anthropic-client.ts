import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Model IDs ─────────────────────────────────────────────────────────────────

export const MODELS = {
  OPUS:   'gemini-2.5-flash-lite',
  SONNET: 'gemini-2.5-flash-lite',
  HAIKU:  'gemini-2.5-flash-lite',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

// ── Client configuration ──────────────────────────────────────────────────────

export interface ClientConfig {
  /** Retries on network errors. Default: 3. */
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
  messages:             Array<{ role: string; content: string }>;
  max_tokens:           number;
  temperature?:         number;
  /** Overrides the global timeout for this specific request. */
  timeout_ms?:          number;
  /**
   * Cache control (kept for API compatibility, not used by Gemini).
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

/** Thrown when GEMINI_API_KEY is missing or the key is rejected (401). */
export class LLMAuthError extends LLMError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, 401);
    this.name = 'LLMAuthError';
  }
}

/** Thrown after exhausting all retries on rate limit responses. */
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
  private readonly sdk:    GoogleGenerativeAI;
  private readonly config: Required<ClientConfig>;
  private lastCallTime: number = 0;

  private constructor(apiKey: string, config: ClientConfig) {
    this.config = {
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      timeoutMs:  config.timeoutMs  ?? DEFAULT_TIMEOUT_MS,
    };
    this.sdk = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Returns the shared instance. The first call sets the config;
   * subsequent calls ignore the config argument and return the existing instance.
   */
  static getInstance(config?: ClientConfig): AnthropicClient {
    if (AnthropicClient.instance) return AnthropicClient.instance;

    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
      throw new LLMAuthError('GEMINI_API_KEY environment variable is not set');
    }

    AnthropicClient.instance = new AnthropicClient(apiKey, config ?? {});
    return AnthropicClient.instance;
  }

  // ── complete ──────────────────────────────────────────────────────────────

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Retry loop: first attempt + 2 retries on rate limit
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        // Gemini uses generative AI model
        const model = this.sdk.getGenerativeModel({ model: request.model });

        // Build conversation with system prompt
        const conversation = [
          {
            role: 'user' as const,
            parts: [{ text: request.system }],
          },
          ...request.messages.map(msg => ({
            role: msg.role === 'assistant' ? ('model' as const) : ('user' as const),
            parts: [{ text: msg.content }],
          })),
        ];

        const totalChars = request.system.length +
          request.messages.reduce((sum, m) => sum + m.content.length, 0);
        console.log(`[Gemini] Attempt ${attempt + 1}: ${request.model} request with ${totalChars} total chars`);

        // Create chat session and send message
        const chat = model.startChat({ history: conversation.slice(0, -1) });
        const result = await chat.sendMessage(conversation[conversation.length - 1].parts[0].text);
        const response = result.response;

        const text = response.text();
        if (!text) {
          throw new LLMError('API response contained no text', response);
        }

        this.lastCallTime = Date.now();
        const usageMetadata = response.usageMetadata;
        const inputTokens = usageMetadata?.promptTokenCount || 0;
        const outputTokens = usageMetadata?.candidatesTokenCount || 0;
        const totalTokens = inputTokens + outputTokens;
        console.log(`[Gemini Tokens] Input: ${inputTokens}, Output: ${outputTokens}, Total: ${totalTokens}`);

        return {
          text,
          model: request.model,
          input_tokens:  inputTokens,
          output_tokens: outputTokens,
          stop_reason:   response.candidates?.[0]?.finishReason || 'unknown',
        };
      } catch (err) {
        const isRateLimit = isRateLimitError(err);

        if (isRateLimit && attempt < 2) {
          // Rate limit: wait and retry
          const waitTime = 5000 * Math.pow(2, attempt); // 5s, 10s, 20s
          console.warn(`[Gemini] Rate limit hit on attempt ${attempt + 1}. Waiting ${waitTime}ms before retry...`);
          await this.sleep(waitTime);
          continue;
        }

        // Last attempt failed or non-rate-limit error: throw
        console.error('[Gemini] Error:', err instanceof Error ? err.message : err);
        throw mapError(err, this.config.timeoutMs);
      }
    }

    // Should not reach here, but fail gracefully
    throw new LLMError('Failed all completion attempts');
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

  // ── Private helpers ────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Test utility ──────────────────────────────────────────────────────────
  // Clears the singleton between tests so each test starts with a clean slate.

  static _reset(): void {
    AnthropicClient.instance = null;
  }
}

// ── Module-level helpers ──────────────────────────────────────────────────────

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('429') || err.message.includes('too many requests') ||
           err.message.includes('rate limit');
  }
  return false;
}

function mapError(err: unknown, timeoutMs: number): LLMError {
  if (err instanceof LLMError) return err;

  if (!(err instanceof Error)) {
    return new LLMError(`Gemini API error: ${String(err)}`);
  }

  // Check for timeout
  if (err.message.includes('timeout') || err.message.includes('Timeout')) {
    return new LLMTimeoutError(`Request timed out after ${timeoutMs}ms`, err);
  }

  // Check for auth errors
  if (err.message.includes('401') || err.message.includes('UNAUTHENTICATED') ||
      err.message.includes('API key')) {
    return new LLMAuthError(
      'Authentication failed — check GEMINI_API_KEY',
      err,
    );
  }

  // Check for rate limit
  if (err.message.includes('429') || err.message.includes('too many requests') ||
      err.message.includes('rate limit')) {
    return new LLMRateLimitError(
      `Rate limit exceeded: ${err.message}`,
      err,
    );
  }

  return new LLMError(`Gemini API error: ${err.message}`, err);
}
