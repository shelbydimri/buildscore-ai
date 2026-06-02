import type { DefineAgentInput, DefineOutput } from '../types/agent-types';
import { AnthropicClient, LLMError } from '../src/llm/anthropic-client';
import { buildDefinePrompt } from '../src/prompts/define-agent.prompt';

export class DefineAgent {
  constructor() {}

  // ── Public ─────────────────────────────────────────────────────────────────

  async execute(input: DefineAgentInput): Promise<DefineOutput> {
    this.validateInput(input);

    const output = await AnthropicClient
      .getInstance()
      .completeJSON<DefineOutput>(buildDefinePrompt(input));

    this.validateOutput(output);
    return output;
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private validateInput(input: DefineAgentInput): void {
    if (!input.idea || input.idea.trim() === '') {
      throw new Error('DefineAgent: input.idea is required');
    }
  }

  // ── Output contract ────────────────────────────────────────────────────────
  // Throws LLMError on any contract violation.
  // callWithRetry in the orchestrator retries once, then halts the pipeline.

  private validateOutput(output: DefineOutput): void {
    // Verify the model returned this agent's output and not another agent's.
    if (output.agent !== 'define-problem') {
      throw new LLMError(
        `DefineAgent: wrong agent field — expected "define-problem", got "${String(output.agent)}"`,
        output,
      );
    }

    if (output.analysis_status !== 'complete' && output.analysis_status !== 'insufficient_input') {
      throw new LLMError(
        `DefineAgent: unexpected analysis_status "${String(output.analysis_status)}"`,
        output,
      );
    }

    if (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 100) {
      throw new LLMError(
        `DefineAgent: confidence must be 0–100, got "${String(output.confidence)}"`,
        output,
      );
    }

    // insufficient_input path: pipeline halts after this; only critical_unknowns is required.
    if (output.analysis_status === 'insufficient_input') {
      if (!Array.isArray(output.critical_unknowns) || output.critical_unknowns.length === 0) {
        throw new LLMError(
          'DefineAgent: insufficient_input must include at least one critical_unknown',
          output,
        );
      }
      return;
    }

    // complete path: enforce all success criteria from agent-contracts.md.
    this.validateCompleteOutput(output);
  }

  private validateCompleteOutput(output: DefineOutput): void {
    // Required non-empty strings — checked together to keep the list in one place.
    const requiredStrings: Array<[string, unknown]> = [
      ['neutral_restatement',         output.neutral_restatement],
      ['initial_problem_statement',   output.initial_problem_statement],
      ['problem_statement',           output.problem_statement],
      ['why_now',                     output.why_now],
      ['pain_profile.type_basis',     output.pain_profile?.type_basis],
      ['pain_profile.emotional_cost', output.pain_profile?.emotional_cost],
    ];

    for (const [field, value] of requiredStrings) {
      if (typeof value !== 'string' || !value.trim()) {
        throw new LLMError(`DefineAgent: ${field} is empty or missing`, output);
      }
    }

    // Numeric score in range.
    if (
      typeof output.problem_strength_score !== 'number' ||
      output.problem_strength_score < 0 ||
      output.problem_strength_score > 100
    ) {
      throw new LLMError(
        `DefineAgent: problem_strength_score must be 0–100, got "${String(output.problem_strength_score)}"`,
        output,
      );
    }

    this.validateBreakdown(output);
  }

  private validateBreakdown(output: DefineOutput): void {
    const b = output.problem_strength_breakdown;
    const dims = [
      'pain_intensity',
      'frequency',
      'user_specificity',
      'evidence_quality',
      'urgency_and_willingness_to_pay',
    ] as const;

    for (const dim of dims) {
      // Runtime guard: basis can be null/undefined if the model omits it,
      // even though the TypeScript type says string.
      const basis = b[dim]?.basis;
      if (typeof basis !== 'string' || !basis.trim()) {
        throw new LLMError(
          `DefineAgent: problem_strength_breakdown.${dim}.basis is empty or missing`,
          output,
        );
      }
    }
  }
}
