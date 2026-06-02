import type { DefineAgentInput, DefineOutput } from '../types/agent-types';
import { AnthropicClient, LLMError } from '../src/llm/anthropic-client';
import { buildDefineAgentPrompt } from '../src/prompts/define-agent.prompt';

export class DefineAgent {
  constructor() {}

  // ── Public ─────────────────────────────────────────────────────────────────

  async execute(input: DefineAgentInput): Promise<DefineOutput> {
    this.validateInput(input);

    const client = AnthropicClient.getInstance();
    const output = await client.completeJSON<DefineOutput>(buildDefineAgentPrompt(input));

    this.validateOutput(output);
    return output;
  }

  // ── Input validation ───────────────────────────────────────────────────────

  private validateInput(input: DefineAgentInput): void {
    if (!input.idea || input.idea.trim() === '') {
      throw new Error('DefineAgent: input.idea is required');
    }
  }

  // ── Output contract enforcement ────────────────────────────────────────────
  // Throws LLMError on any contract violation.
  // The orchestrator's callWithRetry will retry once, then halt the pipeline.

  private validateOutput(output: DefineOutput): void {
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

    // insufficient_input path — only critical_unknowns is required
    if (output.analysis_status === 'insufficient_input') {
      if (!output.critical_unknowns?.length) {
        throw new LLMError(
          'DefineAgent: insufficient_input must include at least one critical_unknown',
          output,
        );
      }
      return;
    }

    // complete path — full contract (agent-contracts.md §Define Agent success criteria)
    if (!output.problem_statement?.trim()) {
      throw new LLMError('DefineAgent: problem_statement is empty', output);
    }
    if (!output.pain_profile?.type_basis?.trim()) {
      throw new LLMError('DefineAgent: pain_profile.type_basis is empty', output);
    }
    if (!output.pain_profile?.emotional_cost?.trim()) {
      throw new LLMError('DefineAgent: pain_profile.emotional_cost is empty', output);
    }
    if (!output.why_now?.trim()) {
      throw new LLMError('DefineAgent: why_now is empty', output);
    }
    if (
      typeof output.problem_strength_score !== 'number' ||
      output.problem_strength_score < 0 ||
      output.problem_strength_score > 100
    ) {
      throw new LLMError('DefineAgent: problem_strength_score must be 0–100', output);
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
      if (!b[dim].basis.trim()) {
        throw new LLMError(
          `DefineAgent: problem_strength_breakdown.${dim}.basis is empty`,
          output,
        );
      }
    }
  }
}
