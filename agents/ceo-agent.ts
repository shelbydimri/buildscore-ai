import type { CEOAgentInput, StartupValidationOutput } from '../types/agent-types';
import { AnthropicClient, LLMError } from '../src/llm/anthropic-client';
import { buildCEOPrompt } from '../src/prompts/ceo-agent.prompt';

// This literal must appear verbatim in build_recommendations.note.
// It prevents downstream callers from treating the list as a product roadmap.
const REQUIRED_NOTE =
  'Build/avoid items are validation-scoped from MVP Planning, not a product roadmap.' as const;

export class CEOAgent {
  constructor() {}

  // ── Public ─────────────────────────────────────────────────────────────────

  async execute(input: CEOAgentInput): Promise<StartupValidationOutput> {
    this.validateInput(input);

    const output = await AnthropicClient
      .getInstance()
      .completeJSON<StartupValidationOutput>(buildCEOPrompt(input));

    this.validateOutput(output, input);
    return output;
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private validateInput(input: CEOAgentInput): void {
    if (!input.verification_output) {
      throw new Error('CEOAgent: verification_output is required — this is the trust gate');
    }
  }

  // ── Output contract ────────────────────────────────────────────────────────

  private validateOutput(output: StartupValidationOutput, input: CEOAgentInput): void {
    if (output.agent !== 'startup-validation') {
      throw new LLMError(
        `CEOAgent: wrong agent field — expected "startup-validation", got "${String(output.agent)}"`,
        output,
      );
    }

    if (
      output.decision !== 'PROCEED' &&
      output.decision !== 'PROCEED WITH CAUTION' &&
      output.decision !== 'DO NOT BUILD'
    ) {
      throw new LLMError(
        `CEOAgent: invalid decision "${String(output.decision)}" — must be "PROCEED", "PROCEED WITH CAUTION", or "DO NOT BUILD"`,
        output,
      );
    }

    if (
      typeof output.decision_confidence !== 'number' ||
      output.decision_confidence < 0 ||
      output.decision_confidence > 100
    ) {
      throw new LLMError(
        `CEOAgent: decision_confidence must be 0–100, got "${String(output.decision_confidence)}"`,
        output,
      );
    }

    // Trust gate rules (evaluated against the input verdict — ground truth)
    this.validateTrustGate(output, input);

    // Build the ledger ID set once; used by dimension and rationale checks
    const ledgerIds = this.buildLedgerIds(output);

    this.validateDimensionScores(output, ledgerIds);
    this.validateRationale(output, ledgerIds);
    this.validateMarketSizeCarry(output);
    this.validateBuildRecommendations(output);
    this.validateFastestNextAction(output);
  }

  // ── Trust gate ─────────────────────────────────────────────────────────────
  // Cross-references input.verification_output.verdict (ground truth) against
  // what the CEO Agent claims in its own trust_gate output.

  private validateTrustGate(output: StartupValidationOutput, input: CEOAgentInput): void {
    const verdict = input.verification_output.verdict;

    // reject → PROCEED is forbidden; status must be untrustworthy_analysis;
    //          gate_result must be 'fail'
    if (verdict === 'reject') {
      if (output.decision === 'PROCEED') {
        throw new LLMError(
          'CEOAgent: trust gate failed — verification verdict is "reject" but decision is "PROCEED"',
          output,
        );
      }
      if (output.decision_status !== 'untrustworthy_analysis') {
        throw new LLMError(
          `CEOAgent: verification verdict is "reject" but decision_status is "${String(output.decision_status)}" — expected "untrustworthy_analysis"`,
          output,
        );
      }
      if (output.trust_gate?.gate_result !== 'fail') {
        throw new LLMError(
          `CEOAgent: verification verdict is "reject" but trust_gate.gate_result is "${String(output.trust_gate?.gate_result)}" — expected "fail"`,
          output,
        );
      }
    }

    // revise → PROCEED is forbidden (trust gate is incomplete)
    if (verdict === 'revise' && output.decision === 'PROCEED') {
      throw new LLMError(
        'CEOAgent: trust gate is incomplete (verification verdict "revise") but decision is "PROCEED"',
        output,
      );
    }
  }

  // ── Evidence ledger ────────────────────────────────────────────────────────

  private buildLedgerIds(output: StartupValidationOutput): Set<string> {
    if (!Array.isArray(output.evidence_ledger)) return new Set<string>();
    return new Set<string>(
      output.evidence_ledger
        .map(e => e.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );
  }

  // ── Dimension scores ───────────────────────────────────────────────────────

  private validateDimensionScores(output: StartupValidationOutput, ledgerIds: Set<string>): void {
    if (!Array.isArray(output.dimension_scores) || output.dimension_scores.length !== 6) {
      throw new LLMError(
        `CEOAgent: dimension_scores must have exactly 6 entries, found ${
          Array.isArray(output.dimension_scores) ? output.dimension_scores.length : 'non-array'
        }`,
        output,
      );
    }

    // Weights must sum to 1.0
    const weightSum = output.dimension_scores.reduce(
      (sum, d) => sum + (typeof d.weight === 'number' ? d.weight : 0),
      0,
    );
    if (Math.abs(weightSum - 1.0) > 0.01) {
      throw new LLMError(
        `CEOAgent: dimension_scores weights sum to ${weightSum.toFixed(3)} — must sum to 1.0 (±0.01)`,
        output,
      );
    }

    // weighted_composite must equal the sum of weighted_contributions
    const contributionSum = output.dimension_scores.reduce(
      (sum, d) => sum + (typeof d.weighted_contribution === 'number' ? d.weighted_contribution : 0),
      0,
    );
    if (
      typeof output.weighted_composite !== 'number' ||
      Math.abs(contributionSum - output.weighted_composite) > 0.1
    ) {
      throw new LLMError(
        `CEOAgent: weighted_contributions sum to ${contributionSum.toFixed(3)} but weighted_composite is ${String(output.weighted_composite)} (tolerance ±0.1)`,
        output,
      );
    }

    // Every dimension must have non-empty ledger_refs pointing to real ledger entries
    for (const dim of output.dimension_scores) {
      if (!Array.isArray(dim.ledger_refs) || dim.ledger_refs.length === 0) {
        throw new LLMError(
          `CEOAgent: dimension_scores[${String(dim.dimension)}].ledger_refs is empty — untraceable score`,
          output,
        );
      }
      for (const ref of dim.ledger_refs) {
        if (!ledgerIds.has(ref)) {
          throw new LLMError(
            `CEOAgent: dimension_scores[${String(dim.dimension)}] ledger_ref "${ref}" not found in evidence_ledger`,
            output,
          );
        }
      }
    }
  }

  // ── Rationale ──────────────────────────────────────────────────────────────

  private validateRationale(output: StartupValidationOutput, ledgerIds: Set<string>): void {
    // strongest_counterargument is required on every decision
    const counterarg = output.decision_rationale?.strongest_counterargument;
    if (typeof counterarg !== 'string' || !counterarg.trim()) {
      throw new LLMError(
        'CEOAgent: decision_rationale.strongest_counterargument is empty — required on every decision',
        output,
      );
    }

    // bear_case is required when decision is not DO NOT BUILD
    if (output.decision !== 'DO NOT BUILD') {
      const bearCase = output.decision_rationale?.bear_case;
      if (typeof bearCase !== 'string' || !bearCase.trim()) {
        throw new LLMError(
          `CEOAgent: decision_rationale.bear_case is empty for decision "${output.decision}"`,
          output,
        );
      }
    }

    // Every primary_factor ledger_ref must resolve to a real ledger entry
    const factors = output.decision_rationale?.primary_factors;
    if (Array.isArray(factors)) {
      for (const factor of factors) {
        const ref = factor.ledger_ref;
        if (typeof ref !== 'string' || !ref.trim()) {
          throw new LLMError(
            'CEOAgent: decision_rationale.primary_factors entry has empty ledger_ref',
            output,
          );
        }
        if (!ledgerIds.has(ref)) {
          throw new LLMError(
            `CEOAgent: decision_rationale.primary_factors ledger_ref "${ref}" not found in evidence_ledger`,
            output,
          );
        }
      }
    }
  }

  // ── Market-size carry ──────────────────────────────────────────────────────

  private validateMarketSizeCarry(output: StartupValidationOutput): void {
    if (output.market_size_carry_detected !== true) return;
    const hasKnockout = Array.isArray(output.knockouts_triggered) &&
      output.knockouts_triggered.some(k => k.decision_cap === 'PROCEED WITH CAUTION');
    if (!hasKnockout) {
      throw new LLMError(
        'CEOAgent: market_size_carry_detected is true but no "PROCEED WITH CAUTION" knockout entry found',
        output,
      );
    }
  }

  // ── Build recommendations note ─────────────────────────────────────────────

  private validateBuildRecommendations(output: StartupValidationOutput): void {
    // Cast to string so TypeScript does not treat the comparison as always-false
    // (the field has a literal type, but the model may return anything at runtime)
    const note = output.build_recommendations?.note as string | undefined;
    if (note !== REQUIRED_NOTE) {
      throw new LLMError(
        `CEOAgent: build_recommendations.note is missing or altered — must be: "${REQUIRED_NOTE}"`,
        output,
      );
    }
  }

  // ── Fastest next action ────────────────────────────────────────────────────

  private validateFastestNextAction(output: StartupValidationOutput): void {
    const action = output.fastest_next_action?.action;
    if (typeof action !== 'string' || !action.trim()) {
      throw new LLMError(
        'CEOAgent: fastest_next_action.action is empty or missing',
        output,
      );
    }
  }
}
