import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MODELS, type CompletionRequest } from '../llm/anthropic-client';
import type { ResearchAgentInput, MarketAnalysisOutput } from '../../types/agent-types';

const SKILLS = resolve(dirname(fileURLToPath(import.meta.url)), '../../.claude/skills');

// The Research Agent runs two skills sequentially.
// Each has its own system prompt and its own CompletionRequest builder.

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
    messages:            [{ role: 'user', content: JSON.stringify(input, null, 2) }],
    max_tokens:          8192,
    cache_system_prompt: true,
  };
}

// ── Skill 2: competitor-analysis ──────────────────────────────────────────────
// Accepts the market_analysis_output from skill 1 so the competitor scope
// is bounded by the beachhead segment and market definition already produced.

export function buildCompetitorAnalysisPrompt(
  input: ResearchAgentInput,
  marketAnalysis?: MarketAnalysisOutput,
): CompletionRequest {
  const userContent = marketAnalysis
    ? JSON.stringify({ ...input, market_analysis_output: marketAnalysis }, null, 2)
    : JSON.stringify(input, null, 2);

  return {
    model:               MODELS.SONNET,
    system:              COMPETITOR_ANALYSIS_SYSTEM_PROMPT,
    messages:            [{ role: 'user', content: userContent }],
    max_tokens:          8192,
    cache_system_prompt: true,
  };
}
