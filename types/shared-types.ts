// ─── shared-types.ts ──────────────────────────────────────────────────────────
// Primitive types and shared structures referenced by all five agents.
// Import from here; never redefine locally.

// ─── Pipeline-level enums ────────────────────────────────────────────────────

export type AnalysisStatus =
  | 'complete'
  | 'insufficient_input'   // Define: idea too vague to analyze
  | 'blocked_by_define'    // Research / Strategy: Define output is insufficient
  | 'insufficient_data'    // Research: market data too thin to size
  | 'incomplete_pipeline'; // Verification / CEO: a required upstream output is missing

export type EvidenceStatus = 'validated' | 'assumed' | 'unknown';

export type Severity = 'critical' | 'major' | 'minor';

export type PipelineAction = 'halt' | 'cap_confidence' | 'flag_only';

export type Effort = 'low' | 'medium' | 'high';

/** Friction / switching cost scale used across Define, Market, and Competitor outputs. */
export type Friction = 'high' | 'medium' | 'low' | 'unknown';

// ─── Shared structures ───────────────────────────────────────────────────────

/**
 * Base assumption record.
 * `evidence_source` is intentionally typed as `string` here because each agent
 * narrows it to its own specific union — see per-agent types in agent-types.ts.
 */
export interface Assumption {
  claim: string;
  status: EvidenceStatus;
  /** Narrowed to a specific union by each agent. */
  evidence_source: string;
  evidence_detail: string;
}

export interface CriticalUnknown {
  question: string;
  impact_if_unresolved: string;
  /** Present on Research, Strategy, and Verification outputs. */
  blocks_downstream?: boolean;
}

export interface RedFlag {
  type: string;
  description: string;
  severity: Severity;
  pipeline_action: PipelineAction;
}

export interface RecommendedAction {
  action: string;
  expected_signal: string;
  effort: Effort;
  /** Integer; 1 = highest priority. */
  priority: number;
}

export interface ScoreDimension {
  /** Actual score, 0 to `max`. */
  score: number;
  max: number;
  /** Required; must not be empty. */
  basis: string;
}
