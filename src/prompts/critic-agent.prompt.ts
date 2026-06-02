import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MODELS, type CompletionRequest } from '../llm/anthropic-client';
import type { CriticAgentInput } from '../../types/agent-types';

// Opus: the Critic is the trust gate. It audits the entire upstream pipeline
// for hallucinations, assumption laundering, and contradictions.
// Quality here directly determines whether the CEO Agent's decision is reliable.
export const SYSTEM_PROMPT = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../.claude/skills/verification/SKILL.md'),
  'utf-8',
);

export function buildCriticAgentPrompt(input: CriticAgentInput): CompletionRequest {
  return {
    model:               MODELS.OPUS,
    system:              SYSTEM_PROMPT,
    messages:            [{ role: 'user', content: JSON.stringify(input, null, 2) }],
    max_tokens:          8192,
    cache_system_prompt: true,
  };
}
