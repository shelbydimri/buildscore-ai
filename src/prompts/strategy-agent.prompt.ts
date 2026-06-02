import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MODELS, type CompletionRequest } from '../llm/anthropic-client';
import type { StrategyAgentInput } from '../../types/agent-types';

export const SYSTEM_PROMPT = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../.claude/skills/mvp-planning/SKILL.md'),
  'utf-8',
);

export function buildStrategyPrompt(input: StrategyAgentInput): CompletionRequest {
  return {
    model:               MODELS.SONNET,
    system:              SYSTEM_PROMPT,
    messages:            [{ role: 'user', content: userMessage(input) }],
    max_tokens:          8192,
    cache_system_prompt: true,
  };
}

function userMessage(input: StrategyAgentInput): string {
  return [
    'Analyze the pipeline outputs below.',
    'Return a single raw JSON object — MvpPlanningOutput with "agent": "mvp-planning".',
    'Return ONLY the JSON. No markdown. No code fences. No explanations.',
    '',
    '<input>',
    JSON.stringify(input, null, 2),
    '</input>',
  ].join('\n');
}
