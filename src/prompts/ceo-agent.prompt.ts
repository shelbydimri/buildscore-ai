import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MODELS, type CompletionRequest } from '../llm/anthropic-client';
import type { CEOAgentInput } from '../../types/agent-types';

export const SYSTEM_PROMPT = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../.claude/skills/startup-validation/SKILL.md'),
  'utf-8',
);

export function buildCEOPrompt(input: CEOAgentInput): CompletionRequest {
  return {
    model:               MODELS.OPUS,
    system:              SYSTEM_PROMPT,
    messages:            [{ role: 'user', content: userMessage(input) }],
    max_tokens:          8192,
    cache_system_prompt: true,
  };
}

function userMessage(input: CEOAgentInput): string {
  return [
    'Synthesize the full pipeline below and produce the final build decision.',
    'Return a single raw JSON object — StartupValidationOutput with "agent": "startup-validation".',
    'Return ONLY the JSON. No markdown. No code fences. No explanations.',
    '',
    '<input>',
    JSON.stringify(input, null, 2),
    '</input>',
  ].join('\n');
}
