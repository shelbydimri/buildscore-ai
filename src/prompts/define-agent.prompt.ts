import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MODELS, type CompletionRequest } from '../llm/anthropic-client';
import type { DefineAgentInput } from '../../types/agent-types';

export const SYSTEM_PROMPT = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../.claude/skills/define-problem/SKILL.md'),
  'utf-8',
);

export function buildDefinePrompt(input: DefineAgentInput): CompletionRequest {
  return {
    model:               MODELS.SONNET,
    system:              SYSTEM_PROMPT,
    messages:            [{ role: 'user', content: userMessage(input) }],
    max_tokens:          4096,
    cache_system_prompt: true,
  };
}

function userMessage(input: DefineAgentInput): string {
  return [
    'Analyze the founder submission below.',
    'Return a single raw JSON object — DefineOutput with "agent": "define-problem".',
    'Return ONLY the JSON. No markdown. No code fences. No explanations.',
    '',
    '<founder_submission>',
    JSON.stringify(input, null, 2),
    '</founder_submission>',
  ].join('\n');
}
