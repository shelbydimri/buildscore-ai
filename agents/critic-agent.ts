import type { CriticAgentInput, VerificationOutput } from '../types/agent-types';
import { AnthropicClient, LLMError } from '../src/llm/anthropic-client';
import { buildCriticPrompt } from '../src/prompts/critic-agent.prompt';

export class CriticAgent {
  constructor() {}

  // ── Public ─────────────────────────────────────────────────────────────────

  async execute(input: CriticAgentInput): Promise<VerificationOutput> {
    this.validateInput(input);

    const output = await AnthropicClient
      .getInstance()
      .completeJSON<VerificationOutput>(buildCriticPrompt(input));

    this.validateOutput(output, input.loop_count);
    return output;
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private validateInput(input: CriticAgentInput): void {
    if (input.loop_count < 1 || input.loop_count > 3) {
      throw new Error('CriticAgent: loop_count must be 1, 2, or 3');
    }
    if (input.loop_count > 1 && !input.prior_verification_output) {
      throw new Error('CriticAgent: prior_verification_output is required when loop_count > 1');
    }
  }

  // ── Output contract ────────────────────────────────────────────────────────
  // incomplete_pipeline is passed through; the orchestrator's missing_input
  // gate handles it. All other statuses proceed to full validation.

  private validateOutput(output: VerificationOutput, inputLoopCount: number): void {
    if (output.agent !== 'verification') {
      throw new LLMError(
        `CriticAgent: wrong agent field — expected "verification", got "${String(output.agent)}"`,
        output,
      );
    }

    if (output.analysis_status !== 'complete' && output.analysis_status !== 'incomplete_pipeline') {
      throw new LLMError(
        `CriticAgent: unexpected analysis_status "${String(output.analysis_status)}"`,
        output,
      );
    }

    if (output.verdict !== 'approve' && output.verdict !== 'revise' && output.verdict !== 'reject') {
      throw new LLMError(
        `CriticAgent: invalid verdict "${String(output.verdict)}" — must be "approve", "revise", or "reject"`,
        output,
      );
    }

    if (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 100) {
      throw new LLMError(
        `CriticAgent: confidence must be 0–100, got "${String(output.confidence)}"`,
        output,
      );
    }

    if (
      typeof output.trustworthiness_score !== 'number' ||
      output.trustworthiness_score < 0 ||
      output.trustworthiness_score > 100
    ) {
      throw new LLMError(
        `CriticAgent: trustworthiness_score must be 0–100, got "${String(output.trustworthiness_score)}"`,
        output,
      );
    }

    if (output.analysis_status !== 'complete') return;

    // ── Success criteria: agent-contracts.md §Critic Agent
    this.validateCompleteOutput(output, inputLoopCount);
  }

  private validateCompleteOutput(output: VerificationOutput, inputLoopCount: number): void {
    // The model must echo back the same loop_count it received.
    if (output.loop_count !== inputLoopCount) {
      throw new LLMError(
        `CriticAgent: output.loop_count ${output.loop_count} does not match input loop_count ${inputLoopCount}`,
        output,
      );
    }

    // approve with any blocking_issues is a contract violation.
    if (
      output.verdict === 'approve' &&
      Array.isArray(output.blocking_issues) &&
      output.blocking_issues.length > 0
    ) {
      throw new LLMError(
        'CriticAgent: verdict is "approve" but blocking_issues is non-empty — contract violation',
        output,
      );
    }

    // Loop-limit logic: On loop_count == 3, verdict must not be "revise".
    // The skill must upgrade revise → approve with ceo_caveats if only minor issues remain.
    if (inputLoopCount === 3 && output.verdict === 'revise') {
      throw new LLMError(
        'CriticAgent: on loop_count == 3, verdict must be "approve" (with ceo_caveats) or "reject", not "revise" — no fourth loop allowed',
        output,
      );
    }

    // When loop_limit_reached is true, ceo_caveats must be populated with unresolved issues.
    if (output.pipeline_recommendation.loop_limit_reached === true) {
      const caveats = output.pipeline_recommendation.ceo_caveats;
      if (!Array.isArray(caveats) || caveats.length === 0) {
        throw new LLMError(
          'CriticAgent: loop_limit_reached is true but ceo_caveats is empty — every unresolved issue must be listed',
          output,
        );
      }
    }

    // Every required_revision must have a non-empty, actionable resolution.
    if (Array.isArray(output.required_revisions)) {
      for (const rev of output.required_revisions) {
        const resolution = rev.resolution;
        if (typeof resolution !== 'string' || !resolution.trim()) {
          throw new LLMError(
            'CriticAgent: required_revisions entry has empty or missing resolution',
            output,
          );
        }
      }
    }

    // prior_issues_resolved must be present and non-empty on loop > 1.
    if (inputLoopCount > 1) {
      if (
        !Array.isArray(output.prior_issues_resolved) ||
        output.prior_issues_resolved.length === 0
      ) {
        throw new LLMError(
          `CriticAgent: prior_issues_resolved must be non-empty when loop_count > 1 (loop ${inputLoopCount})`,
          output,
        );
      }
    }

    // hallucinated_claims must be consistent with hallucinated_count.
    this.validateHallucinationLedger(output);

    // trustworthiness_breakdown scores must sum to trustworthiness_score.
    this.validateTrustworthinessBreakdown(output);
  }

  private validateHallucinationLedger(output: VerificationOutput): void {
    const eq = output.evidence_quality;
    if (!eq) return;

    const count  = eq.hallucinated_count;
    const claims = eq.hallucinated_claims;

    if (typeof count === 'number' && count === 0 &&
        Array.isArray(claims) && claims.length > 0) {
      throw new LLMError(
        'CriticAgent: evidence_quality.hallucinated_count is 0 but hallucinated_claims is non-empty',
        output,
      );
    }

    if (typeof count === 'number' && count > 0 &&
        (!Array.isArray(claims) || claims.length === 0)) {
      throw new LLMError(
        `CriticAgent: evidence_quality.hallucinated_count is ${count} but hallucinated_claims is empty`,
        output,
      );
    }
  }

  private validateTrustworthinessBreakdown(output: VerificationOutput): void {
    const b = output.trustworthiness_breakdown;
    const dims = [
      'evidence_integrity',
      'internal_consistency',
      'assumption_transparency',
      'risk_completeness',
      'confidence_calibration',
    ] as const;

    let sum = 0;

    for (const dim of dims) {
      const d = b[dim];

      const basis = d?.basis;
      if (typeof basis !== 'string' || !basis.trim()) {
        throw new LLMError(
          `CriticAgent: trustworthiness_breakdown.${dim}.basis is empty or missing`,
          output,
        );
      }

      const score = d?.score;
      if (typeof score === 'number') sum += score;
    }

    // Allow ±1 rounding tolerance.
    if (Math.abs(sum - output.trustworthiness_score) > 1) {
      throw new LLMError(
        `CriticAgent: trustworthiness_breakdown scores sum to ${sum} but trustworthiness_score is ${output.trustworthiness_score} (tolerance ±1)`,
        output,
      );
    }
  }
}
