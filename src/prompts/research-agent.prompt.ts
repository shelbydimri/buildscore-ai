import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MODELS, type CompletionRequest } from '../llm/anthropic-client';
import type { ResearchAgentInput, MarketAnalysisOutput } from '../../types/agent-types';

const SKILLS = resolve(dirname(fileURLToPath(import.meta.url)), '../../.claude/skills');

export const MARKET_ANALYSIS_SYSTEM_PROMPT = readFileSync(
  resolve(SKILLS, 'market-analysis/SKILL.md'),
  'utf-8',
);

export const COMPETITOR_ANALYSIS_SYSTEM_PROMPT = readFileSync(
  resolve(SKILLS, 'competitor-analysis/SKILL.md'),
  'utf-8',
);

// ── Skill 1: market-analysis ──────────────────────────────────────────────────

export function buildMarketAnalysisPrompt(input: ResearchAgentInput): CompletionRequest {
  return {
    model:               MODELS.SONNET,
    system:              MARKET_ANALYSIS_SYSTEM_PROMPT,
    messages:            [{ role: 'user', content: marketUserMessage(input) }],
    max_tokens:          8192,
    cache_system_prompt: true,
  };
}

// ── Skill 2: competitor-analysis ──────────────────────────────────────────────
// Passes market_analysis_output so competitor scope is bounded by the
// beachhead segment and market definition already produced.

export function buildCompetitorAnalysisPrompt(
  input: ResearchAgentInput,
  marketAnalysis?: MarketAnalysisOutput,
): CompletionRequest {
  const payload = marketAnalysis
    ? { ...input, market_analysis_output: marketAnalysis }
    : input;

  return {
    model:               MODELS.SONNET,
    system:              COMPETITOR_ANALYSIS_SYSTEM_PROMPT,
    messages:            [{ role: 'user', content: competitorUserMessage(payload) }],
    max_tokens:          8192,
    cache_system_prompt: true,
  };
}

// ── User message builders ─────────────────────────────────────────────────────

function marketUserMessage(input: ResearchAgentInput): string {
  // Extract only essential fields from define_output to reduce token count
  const essentialDefineOutput = input.define_output ? {
    problem_statement: input.define_output.problem_statement,
    confidence: input.define_output.confidence,
  } : null;

  const minimalInput = {
    founder_brief: input.founder_brief,
    define_output: essentialDefineOutput,
  };

  return [
    'Analyze the inputs below.',
    'Return a single raw JSON object — MarketAnalysisOutput with "agent": "market-analysis".',
    'Return ONLY the JSON. No markdown. No code fences. No explanations.',
    '',
    '<input>',
    JSON.stringify(minimalInput),
    '</input>',
  ].join('\n');
}

function competitorUserMessage(payload: any): string {
  // Extract only essential fields from market analysis to reduce token count
  const minimalPayload = {
    founder_brief: payload.founder_brief,
    market_analysis_output: payload.market_analysis_output ? {
      beachhead_segment: payload.market_analysis_output.beachhead_segment,
      market_definition: payload.market_analysis_output.market_definition,
      tam_estimate_usd: payload.market_analysis_output.tam_estimate_usd,
    } : null,
  };

  return [
    'Analyze the inputs below.',
    'Return a single raw JSON object — CompetitorAnalysisOutput with "agent": "competitor-analysis".',
    'Return ONLY the JSON. No markdown. No code fences. No explanations.',
    '',
    '<input>',
    JSON.stringify(minimalPayload),
    '</input>',
  ].join('\n');
}
