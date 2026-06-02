import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MODELS, type CompletionRequest } from '../llm/anthropic-client';
import type { DefineAgentInput } from '../../types/agent-types';

// Loaded once at module initialization.
// cache_system_prompt: true reduces latency and cost on repeated calls
// because this skill definition is large and stable between runs.
export const SYSTEM_PROMPT = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../.claude/skills/define-problem/SKILL.md'),
  'utf-8',
);

export function buildDefineAgentPrompt(input: DefineAgentInput): CompletionRequest {
  return {
    model:               MODELS.SONNET,
    system:              SYSTEM_PROMPT,
    messages:            [{ role: 'user', content: JSON.stringify(input, null, 2) }],
    max_tokens:          8192,
    cache_system_prompt: true,
  };
}
