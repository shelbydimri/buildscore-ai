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
  // Extract only essential fields to reduce token count
  const minimalInput = {
    define_output: input.define_output ? {
      problem_statement: input.define_output.problem_statement,
      confidence: input.define_output.confidence,
    } : null,
    market_analysis_output: input.market_analysis_output ? {
      beachhead_segment: input.market_analysis_output.beachhead_segment,
      tam_estimate_usd: input.market_analysis_output.tam_estimate_usd,
    } : null,
    competitor_analysis_output: input.competitor_analysis_output ? {
      competitive_moat: input.competitor_analysis_output.competitive_moat,
      num_direct_competitors: input.competitor_analysis_output.num_direct_competitors,
    } : null,
    mvp_planning_output: input.mvp_planning_output ? {
      timeline_weeks: input.mvp_planning_output.timeline_weeks,
      estimated_cost_usd: input.mvp_planning_output.estimated_cost_usd,
    } : null,
    verification_output: input.verification_output ? {
      verdict: input.verification_output.verdict,
      trustworthiness_score: input.verification_output.trustworthiness_score,
    } : null,
  };

  return [
    'Synthesize the full pipeline below and produce the final build decision.',
    'Return a single raw JSON object — StartupValidationOutput with "agent": "startup-validation".',
    'Return ONLY the JSON. No markdown. No code fences. No explanations.',
    '',
    '<input>',
    JSON.stringify(minimalInput),
    '</input>',
  ].join('\n');
}
