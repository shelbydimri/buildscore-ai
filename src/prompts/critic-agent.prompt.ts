import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MODELS, type CompletionRequest } from '../llm/anthropic-client';
import type { CriticAgentInput } from '../../types/agent-types';

export const SYSTEM_PROMPT = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../.claude/skills/verification/SKILL-groq.md'),
  'utf-8',
);

export function buildCriticPrompt(input: CriticAgentInput): CompletionRequest {
  return {
    model:               MODELS.OPUS,
    system:              SYSTEM_PROMPT,
    messages:            [{ role: 'user', content: userMessage(input) }],
    max_tokens:          8192,
    cache_system_prompt: true,
  };
}

function userMessage(input: CriticAgentInput): string {
  // Extract only essential fields to reduce token count
  const minimalInput = {
    define_output: input.define_output ? {
      problem_statement: input.define_output.problem_statement,
      confidence: input.define_output.confidence,
    } : null,
    market_analysis_output: input.market_analysis_output ? {
      beachhead_segment: input.market_analysis_output.beachhead_segment,
    } : null,
    competitor_analysis_output: input.competitor_analysis_output ? {
      num_direct_competitors: input.competitor_analysis_output.num_direct_competitors,
    } : null,
    mvp_planning_output: input.mvp_planning_output ? {
      timeline_weeks: input.mvp_planning_output.timeline_weeks,
      estimated_cost_usd: input.mvp_planning_output.estimated_cost_usd,
      core_features: input.mvp_planning_output.core_features?.slice(0, 5), // Top 5 features
    } : null,
    loop_count: input.loop_count,
    prior_verification_output: input.prior_verification_output ? {
      verdict: input.prior_verification_output.verdict,
      required_revisions: input.prior_verification_output.required_revisions?.slice(0, 2), // Top 2
    } : null,
  };

  return [
    'Audit the pipeline outputs below.',
    'Return a single raw JSON object — VerificationOutput with "agent": "verification".',
    'Return ONLY the JSON. No markdown. No code fences. No explanations.',
    '',
    '<input>',
    JSON.stringify(minimalInput),
    '</input>',
  ].join('\n');
}
