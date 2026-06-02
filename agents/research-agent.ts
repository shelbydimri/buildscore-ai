import type {
  ResearchAgentInput,
  MarketAnalysisOutput,
  CompetitorAnalysisOutput,
} from '../types/agent-types';
import { AnthropicClient, LLMError } from '../src/llm/anthropic-client';
import {
  buildMarketAnalysisPrompt,
  buildCompetitorAnalysisPrompt,
} from '../src/prompts/research-agent.prompt';

export interface ResearchAgentOutput {
  market_analysis_output:     MarketAnalysisOutput;
  competitor_analysis_output: CompetitorAnalysisOutput;
}

export class ResearchAgent {
  constructor() {}

  // ── Public ─────────────────────────────────────────────────────────────────

  async execute(input: ResearchAgentInput): Promise<ResearchAgentOutput> {
    this.validateInput(input);

    const client = AnthropicClient.getInstance();

    // Skill 1: market-analysis
    const marketOutput = await client.completeJSON<MarketAnalysisOutput>(
      buildMarketAnalysisPrompt(input),
    );
    this.validateMarketOutput(marketOutput);

    // Skill 2: competitor-analysis
    // Passes marketOutput so the competitor scope is bounded by the beachhead
    // segment and market definition already produced. If marketOutput is
    // blocked_by_define the orchestrator will halt after seeing both outputs.
    const competitorOutput = await client.completeJSON<CompetitorAnalysisOutput>(
      buildCompetitorAnalysisPrompt(input, marketOutput),
    );
    this.validateCompetitorOutput(competitorOutput);

    return { market_analysis_output: marketOutput, competitor_analysis_output: competitorOutput };
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private validateInput(input: ResearchAgentInput): void {
    if (!input.define_output) {
      throw new Error('ResearchAgent: input.define_output is required');
    }
    if (input.define_output.analysis_status === 'insufficient_input') {
      throw new Error('ResearchAgent: define_output is insufficient_input — pipeline should have halted');
    }
  }

  // ── Market Analysis output contract ────────────────────────────────────────
  // blocked_by_define / insufficient_data statuses are passed through.
  // The orchestrator gate halts the pipeline on blocked_by_define.

  private validateMarketOutput(output: MarketAnalysisOutput): void {
    if (output.agent !== 'market-analysis') {
      throw new LLMError(
        `ResearchAgent (market): wrong agent field — expected "market-analysis", got "${String(output.agent)}"`,
        output,
      );
    }

    if (
      output.analysis_status !== 'complete' &&
      output.analysis_status !== 'blocked_by_define' &&
      output.analysis_status !== 'insufficient_data'
    ) {
      throw new LLMError(
        `ResearchAgent (market): unexpected analysis_status "${String(output.analysis_status)}"`,
        output,
      );
    }

    if (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 100) {
      throw new LLMError(
        `ResearchAgent (market): confidence must be 0–100, got "${String(output.confidence)}"`,
        output,
      );
    }

    if (output.analysis_status !== 'complete') return;

    // ── Success criteria: agent-contracts.md §Research Agent / Market Analysis

    if (
      typeof output.market_attractiveness_score !== 'number' ||
      output.market_attractiveness_score < 0 ||
      output.market_attractiveness_score > 100
    ) {
      throw new LLMError('ResearchAgent (market): market_attractiveness_score must be 0–100', output);
    }

    const beachheadCount = Array.isArray(output.customer_segments)
      ? output.customer_segments.filter(s => s.is_beachhead).length
      : 0;
    if (beachheadCount !== 1) {
      throw new LLMError(
        `ResearchAgent (market): expected exactly 1 beachhead segment, found ${beachheadCount}`,
        output,
      );
    }

    this.validateMarketBreakdown(output);

    if (Array.isArray(output.willingness_to_pay)) {
      for (const entry of output.willingness_to_pay) {
        if (!entry.evidence_tier) {
          throw new LLMError(
            'ResearchAgent (market): willingness_to_pay entry is missing evidence_tier',
            output,
          );
        }
      }
    }

    if (Array.isArray(output.market_claims)) {
      for (const claim of output.market_claims) {
        if (!claim.classification) {
          throw new LLMError(
            'ResearchAgent (market): market_claims entry is missing classification',
            output,
          );
        }
      }
    }
  }

  private validateMarketBreakdown(output: MarketAnalysisOutput): void {
    const b = output.market_attractiveness_breakdown;
    const dims = [
      'market_size',
      'growth_trajectory',
      'demand_signal_quality',
      'willingness_to_pay',
      'market_timing',
    ] as const;

    for (const dim of dims) {
      const basis = b[dim]?.basis;
      if (typeof basis !== 'string' || !basis.trim()) {
        throw new LLMError(
          `ResearchAgent (market): market_attractiveness_breakdown.${dim}.basis is empty or missing`,
          output,
        );
      }
    }
  }

  // ── Competitor Analysis output contract ────────────────────────────────────

  private validateCompetitorOutput(output: CompetitorAnalysisOutput): void {
    if (output.agent !== 'competitor-analysis') {
      throw new LLMError(
        `ResearchAgent (competitor): wrong agent field — expected "competitor-analysis", got "${String(output.agent)}"`,
        output,
      );
    }

    if (
      output.analysis_status !== 'complete' &&
      output.analysis_status !== 'blocked_by_define' &&
      output.analysis_status !== 'insufficient_data'
    ) {
      throw new LLMError(
        `ResearchAgent (competitor): unexpected analysis_status "${String(output.analysis_status)}"`,
        output,
      );
    }

    if (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 100) {
      throw new LLMError(
        `ResearchAgent (competitor): confidence must be 0–100, got "${String(output.confidence)}"`,
        output,
      );
    }

    if (output.analysis_status !== 'complete') return;

    // ── Success criteria: agent-contracts.md §Research Agent / Competitor Analysis

    if (!Array.isArray(output.competitors) || output.competitors.length === 0) {
      throw new LLMError(
        'ResearchAgent (competitor): competitors[] must be non-empty',
        output,
      );
    }

    if (!output.competitors.some(c => c.type === 'workaround')) {
      throw new LLMError(
        'ResearchAgent (competitor): competitors[] must include at least one workaround entry',
        output,
      );
    }

    if (
      typeof output.landscape_score !== 'number' ||
      output.landscape_score < 0 ||
      output.landscape_score > 100
    ) {
      throw new LLMError('ResearchAgent (competitor): landscape_score must be 0–100', output);
    }

    this.validateLandscapeBreakdown(output);

    if (Array.isArray(output.differentiation_opportunities)) {
      for (const opp of output.differentiation_opportunities) {
        const basis = opp.defensibility_basis;
        if (typeof basis !== 'string' || !basis.trim()) {
          throw new LLMError(
            'ResearchAgent (competitor): differentiation_opportunity missing defensibility_basis',
            output,
          );
        }
        if (!Array.isArray(opp.source_complaints) || opp.source_complaints.length === 0) {
          throw new LLMError(
            'ResearchAgent (competitor): differentiation_opportunity has empty source_complaints',
            output,
          );
        }
      }
    }
  }

  private validateLandscapeBreakdown(output: CompetitorAnalysisOutput): void {
    const b = output.landscape_score_breakdown;
    const dims = [
      'incumbent_vulnerability',
      'switching_cost_manageability',
      'differentiation_clarity',
      'incumbent_response_risk',
      'workaround_quality',
    ] as const;

    for (const dim of dims) {
      const basis = b[dim]?.basis;
      if (typeof basis !== 'string' || !basis.trim()) {
        throw new LLMError(
          `ResearchAgent (competitor): landscape_score_breakdown.${dim}.basis is empty or missing`,
          output,
        );
      }
    }
  }
}
