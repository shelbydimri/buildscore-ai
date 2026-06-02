import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MODELS, type CompletionRequest } from '../llm/anthropic-client';
import type { CEOAgentInput } from '../../types/agent-types';

// Opus: the CEO Agent produces the final PROCEED / PROCEED WITH CAUTION /
// DO NOT BUILD decision. It applies weighted scoring, knockout overrides,
// and the Verification trust gate. The decision must be evidence-traceable.
export const SYSTEM_PROMPT = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../.claude/skills/startup-validation/SKILL.md'),
  'utf-8',
);

export function buildCEOAgentPrompt(input: CEOAgentInput): CompletionRequest {
  return {
    model:               MODELS.OPUS,
    system:              SYSTEM_PROMPT,
    messages:            [{ role: 'user', content: JSON.stringify(input, null, 2) }],
    max_tokens:          8192,
    cache_system_prompt: true,
  };
}
