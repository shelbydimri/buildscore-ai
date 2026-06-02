// ─── orchestrator-types.ts ────────────────────────────────────────────────────
// Types for the orchestrator's shared pipeline state, routing, and terminal outputs.
// No implementation. No AI calls. No business logic.

import type {
  DefineOutput,
  MarketAnalysisOutput,
  CompetitorAnalysisOutput,
  MvpPlanningOutput,
  VerificationOutput,
  StartupValidationOutput,
  BuildDecision,
  DecisionStatus,
  Verdict,
} from './agent-types';

// ─── Pipeline phases and agents ──────────────────────────────────────────────

export type PipelinePhase = 'define' | 'do' | 'verify';

export type AgentName =
  | 'define-agent'
  | 'research-agent'
  | 'strategy-agent'
  | 'critic-agent'
  | 'ceo-agent';

// ─── Halt reasons ────────────────────────────────────────────────────────────

/**
 * All conditions under which the orchestrator stops the pipeline and returns
 * control to the founder rather than advancing to the next agent.
 */
export type HaltReason =
  /** Define Agent returned analysis_status === 'insufficient_input'. */
  | 'insufficient_input'
  /** Research Agent returned analysis_status === 'blocked_by_define'. */
  | 'blocked_by_define'
  /** Critic Agent returned action === 'return_to_define': problem definition is the root failure. */
  | 'return_to_define'
  /** An agent returned non-conforming output on both the initial attempt and the retry. */
  | 'contract_violation'
  /** An agent was reached without its required upstream input present in pipeline_state. */
  | 'missing_input'
  /** An agent timed out or threw an execution error on both the initial attempt and the retry. */
  | 'agent_failure';

// ─── Pipeline state ───────────────────────────────────────────────────────────

/**
 * The single object the orchestrator carries through a complete run.
 * Null values indicate an agent has not yet run or has been skipped due to a halt.
 */
export interface PipelineState {
  define_output:                DefineOutput | null;
  market_analysis_output:       MarketAnalysisOutput | null;
  competitor_analysis_output:   CompetitorAnalysisOutput | null;
  mvp_planning_output:          MvpPlanningOutput | null;
  verification_output:          VerificationOutput | null;
  startup_validation_output:    StartupValidationOutput | null;
}

// ─── Loop history ─────────────────────────────────────────────────────────────

/** One entry per Critic pass. Passed to the Critic on subsequent loops. */
export interface LoopHistoryEntry {
  /** 1-based pass number. */
  loop_count: number;
  verdict: Verdict;
  trustworthiness_score: number;
  /** Snapshot of required_revisions from that pass. */
  required_revisions: VerificationOutput['required_revisions'];
  /** ISO 8601 timestamp of when the Critic Agent completed this pass. */
  completed_at: string;
}

// ─── Shared run envelope ──────────────────────────────────────────────────────

/** The top-level object the orchestrator maintains for the duration of a run. */
export interface OrchestratorRun {
  run_id: string;
  founder_brief: string;
  /** Current Critic pass count. 0 before the Critic has run; maximum is 3. */
  loop_count: number;
  pipeline_state: PipelineState;
  /** Ordered list of every Critic pass; grows on each revise loop. */
  loop_history: LoopHistoryEntry[];
  /** Populated only when the pipeline halts early. Null on a successful decision run. */
  halt_reason: HaltReason | null;
  /** Populated only when the CEO Agent completes. Null otherwise. */
  final_decision: BuildDecision | null;
}

// ─── Terminal output: decision ────────────────────────────────────────────────

/**
 * Emitted by the orchestrator when the CEO Agent produces a decision.
 * outcome === 'decision'.
 */
export interface OrchestratorDecisionOutput {
  run_id: string;
  outcome: 'decision';
  decision: BuildDecision;
  decision_status: DecisionStatus;
  /** 0–100. From startup_validation_output.decision_confidence. */
  decision_confidence: number;
  rationale: StartupValidationOutput['decision_rationale'];
  fastest_next_action: StartupValidationOutput['fastest_next_action'];
  open_risks: StartupValidationOutput['open_risks'];
  /** Total number of Critic passes that ran (1–3). */
  loop_count: number;
  /** Full evidence ledger from the CEO Agent for traceability. */
  evidence_trace: StartupValidationOutput['evidence_ledger'];
}

// ─── Terminal output: halt ────────────────────────────────────────────────────

/**
 * Emitted by the orchestrator when a gate or unrecoverable error stops the pipeline.
 * outcome === 'halt'.
 * A halt is a first-class outcome, not a failure to be hidden.
 */
export interface OrchestratorHaltOutput {
  run_id: string;
  outcome: 'halt';
  halt_reason: HaltReason;
  /** Name of the agent that was running when the halt occurred. */
  halt_stage: AgentName;
  /**
   * Concrete questions or fixes the founder must address before the run can succeed on retry.
   * Populated from the relevant agent's critical_unknowns[].question or required_revisions[].resolution.
   */
  what_is_needed: string[];
  /** Pipeline state as far as it completed before the halt. Used for resuming rather than restarting. */
  partial_state: Partial<PipelineState>;
}

/** Union of the two possible terminal outputs. */
export type OrchestratorOutput = OrchestratorDecisionOutput | OrchestratorHaltOutput;

// ─── Memory integration ───────────────────────────────────────────────────────

/** Context read from memory files before the Define Agent runs. */
export interface MemoryReadContext {
  founder_preferences: string;
  market_patterns: string;
  decision_history: string;
}

/** Data written to memory after the CEO Agent completes. */
export interface MemoryWritePayload {
  run_id: string;
  final_decision: BuildDecision;
  decision_confidence: number;
  key_risks: StartupValidationOutput['open_risks'];
  market_learnings: string[];
  failed_assumptions: string[];
}

// ─── Gate evaluation helpers ──────────────────────────────────────────────────

/** Describes a gate check the orchestrator performs between agents. */
export interface GateCheck {
  gate_name: 'define_gate' | 'research_gate' | 'problem_root_gate' | 'contract_gate';
  passed: boolean;
  halt_reason?: HaltReason;
  detail: string;
}
