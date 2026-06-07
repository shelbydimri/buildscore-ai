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
  // Extract only essential fields to reduce token count
  const minimalInput = {
    founder_brief: input.founder_brief,
    define_output: input.define_output ? {
      problem_statement: input.define_output.problem_statement,
      confidence: input.define_output.confidence,
    } : null,
    market_analysis_output: input.market_analysis_output ? {
      beachhead_segment: input.market_analysis_output.beachhead_segment,
      market_definition: input.market_analysis_output.market_definition,
      tam_estimate_usd: input.market_analysis_output.tam_estimate_usd,
    } : null,
    competitor_analysis_output: input.competitor_analysis_output ? {
      competitive_moat: input.competitor_analysis_output.competitive_moat,
      num_direct_competitors: input.competitor_analysis_output.num_direct_competitors,
    } : null,
    required_revisions: input.required_revisions?.slice(0, 2), // Only top 2 revisions if looping
  };

  return [
    'Analyze the pipeline outputs below.',
    'Return a single raw JSON object — MvpPlanningOutput with "agent": "mvp-planning".',
    'Return ONLY the JSON. No markdown. No code fences. No explanations.',
    '',
    '<input>',
    JSON.stringify(minimalInput),
    '</input>',
  ].join('\n');
}
