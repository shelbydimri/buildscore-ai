import type { StrategyAgentInput, MvpPlanningOutput } from '../types/agent-types';
import { AnthropicClient, LLMError } from '../src/llm/anthropic-client';
import { buildStrategyPrompt } from '../src/prompts/strategy-agent.prompt';

export class StrategyAgent {
  constructor() {}

  // ── Public ─────────────────────────────────────────────────────────────────

  async execute(input: StrategyAgentInput): Promise<MvpPlanningOutput> {
    this.validateInput(input);

    const output = await AnthropicClient
      .getInstance()
      .completeJSON<MvpPlanningOutput>(buildStrategyPrompt(input));

    this.validateOutput(output);
    return output;
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private validateInput(input: StrategyAgentInput): void {
    if (input.define_output.analysis_status === 'insufficient_input') {
      throw new Error('StrategyAgent: define_output is insufficient_input — pipeline should have halted');
    }
  }

  // ── Output contract ────────────────────────────────────────────────────────
  // blocked_by_define / insufficient_upstream_data are passed through.
  // assumption_inversion_detected === true is a red flag but NOT a contract
  // violation here — the Critic Agent audits and the pipeline continues.

  private validateOutput(output: MvpPlanningOutput): void {
    if (output.agent !== 'mvp-planning') {
      throw new LLMError(
        `StrategyAgent: wrong agent field — expected "mvp-planning", got "${String(output.agent)}"`,
        output,
      );
    }

    if (
      output.analysis_status !== 'complete' &&
      output.analysis_status !== 'blocked_by_define' &&
      output.analysis_status !== 'insufficient_upstream_data'
    ) {
      throw new LLMError(
        `StrategyAgent: unexpected analysis_status "${String(output.analysis_status)}"`,
        output,
      );
    }

    if (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 100) {
      throw new LLMError(
        `StrategyAgent: confidence must be 0–100, got "${String(output.confidence)}"`,
        output,
      );
    }

    if (output.analysis_status !== 'complete') return;

    // ── Success criteria: agent-contracts.md §Strategy Agent
    this.validateCompleteOutput(output);
  }

  private validateCompleteOutput(output: MvpPlanningOutput): void {
    // core_assumption.source_in_define_output must reference an upstream field.
    const source = output.core_assumption?.source_in_define_output;
    if (typeof source !== 'string' || !source.trim()) {
      throw new LLMError(
        'StrategyAgent: core_assumption.source_in_define_output is empty or missing',
        output,
      );
    }

    // Exactly one assumption_stack entry must have is_core_target === true.
    const coreCount = Array.isArray(output.assumption_stack)
      ? output.assumption_stack.filter(a => a.is_core_target).length
      : 0;
    if (coreCount !== 1) {
      throw new LLMError(
        `StrategyAgent: expected exactly 1 assumption_stack entry with is_core_target, found ${coreCount}`,
        output,
      );
    }

    // experiment.time_bound_days must be > 0 — 0 is an explicit contract violation.
    const days = output.experiment?.time_bound_days;
    if (typeof days !== 'number' || days <= 0) {
      throw new LLMError(
        `StrategyAgent: experiment.time_bound_days must be > 0, got "${String(days)}"`,
        output,
      );
    }

    // scope.out_of_scope must be non-empty — empty signals scope was not pressure-tested.
    if (!Array.isArray(output.scope?.out_of_scope) || output.scope.out_of_scope.length === 0) {
      throw new LLMError(
        'StrategyAgent: scope.out_of_scope must be non-empty',
        output,
      );
    }

    // Every success criterion must be behavioral and pre-committed.
    if (Array.isArray(output.success_criteria)) {
      for (const criterion of output.success_criteria) {
        if (criterion.is_behavioral !== true) {
          throw new LLMError(
            'StrategyAgent: success_criteria entry has is_behavioral !== true — attitudinal criteria are a contract violation',
            output,
          );
        }
        if (criterion.is_pre_committed !== true) {
          throw new LLMError(
            'StrategyAgent: success_criteria entry has is_pre_committed !== true',
            output,
          );
        }
      }
    }

    // validation_risks must cover both directions.
    if (!Array.isArray(output.validation_risks)) {
      throw new LLMError('StrategyAgent: validation_risks must be an array', output);
    }
    if (!output.validation_risks.some(r => r.risk_type === 'false_positive')) {
      throw new LLMError(
        'StrategyAgent: validation_risks must include at least one false_positive entry',
        output,
      );
    }
    if (!output.validation_risks.some(r => r.risk_type === 'false_negative')) {
      throw new LLMError(
        'StrategyAgent: validation_risks must include at least one false_negative entry',
        output,
      );
    }

    // mvp_feasibility_score
    if (
      typeof output.mvp_feasibility_score !== 'number' ||
      output.mvp_feasibility_score < 0 ||
      output.mvp_feasibility_score > 100
    ) {
      throw new LLMError(
        `StrategyAgent: mvp_feasibility_score must be 0–100, got "${String(output.mvp_feasibility_score)}"`,
        output,
      );
    }

    this.validateFeasibilityBreakdown(output);
  }

  private validateFeasibilityBreakdown(output: MvpPlanningOutput): void {
    const b = output.mvp_feasibility_breakdown;
    const dims = [
      'assumption_clarity',
      'experiment_design',
      'success_criteria_quality',
      'time_to_learning',
      'validation_risk_management',
    ] as const;

    for (const dim of dims) {
      const basis = b[dim]?.basis;
      if (typeof basis !== 'string' || !basis.trim()) {
        throw new LLMError(
          `StrategyAgent: mvp_feasibility_breakdown.${dim}.basis is empty or missing`,
          output,
        );
      }
    }
  }
}
