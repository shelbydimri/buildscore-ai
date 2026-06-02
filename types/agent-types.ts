// ─── agent-types.ts ───────────────────────────────────────────────────────────
// Input and output contracts for all five BuildScore AI agents.
// No implementation. No AI calls. No business logic.

import type {
  AnalysisStatus,
  Assumption,
  CriticalUnknown,
  Effort,
  EvidenceStatus,
  Friction,
  PipelineAction,
  RedFlag,
  RecommendedAction,
  ScoreDimension,
  Severity,
} from './shared-types';

// ═════════════════════════════════════════════════════════════════════════════
// AGENT 1 — DEFINE AGENT
// Skill: define-problem
// Reads:  founder_brief (pipeline input)
// Writes: define_output
// ═════════════════════════════════════════════════════════════════════════════

export type PainType    = 'painkiller' | 'aspirin' | 'vitamin';
export type Frequency   = 'daily' | 'weekly' | 'monthly' | 'rare' | 'unknown';
export type Intensity   = 'critical' | 'significant' | 'moderate' | 'minor' | 'unknown';
export type Awareness   = 'explicit' | 'latent' | 'unknown';
export type Specificity = 'high' | 'medium' | 'low';
export type Adequacy    = 'adequate' | 'poor' | 'none';

export type DefineEvidenceSource =
  | 'external_interview'
  | 'usage_data'
  | 'third_party_research'
  | 'founder_self_report'
  | 'inferred'
  | 'none';

export type DefineAssumption = Assumption & { evidence_source: DefineEvidenceSource };

export interface DefineAgentInput {
  idea: string;
  target_user?: string;
  current_solutions?: string;
  founder_context?: string;
  prior_research?: string;
}

export interface DefineOutput {
  agent: 'define-problem';
  analysis_status: 'complete' | 'insufficient_input';
  /** 0–100. Certainty in the problem definition only. */
  confidence: number;

  /** Founder's idea rewritten with all solution language removed. */
  neutral_restatement: string;
  /** Problem statement as first extracted, before root-cause testing. */
  initial_problem_statement: string;
  /** Final version after Step 7 root-cause testing. */
  problem_statement: string;
  problem_statement_revised: boolean;
  problem_statement_revision_reason: string;
  /** What changed recently to make this problem newly solvable. 'unknown' is valid. */
  why_now: string;

  target_user: {
    primary: {
      description: string;
      specificity: Specificity;
    };
    secondary: {
      description: string;
      same_as_primary: boolean;
    };
    is_founder_the_user: boolean;
  };

  pain_profile: {
    type: PainType;
    /** Required; evidence for the painkiller / aspirin / vitamin classification. */
    type_basis: string;
    frequency: Frequency;
    intensity: Intensity;
    /** The specific emotion(s). 'unknown' is valid but must not be omitted. */
    emotional_cost: string;
    awareness: Awareness;
    /** Required when awareness === 'latent'. Explains why self-report cannot validate. */
    latent_validation_note: string;
  };

  status_quo: {
    current_solutions: Array<{
      name: string;
      adequacy: Adequacy;
    }>;
    /** Solutions users tried and abandoned — distinct from current_solutions. */
    failed_solutions: Array<{
      name: string;
      reason_for_failure: string;
    }>;
    switching_friction_from_current: Friction;
  };

  assumptions: DefineAssumption[];

  /** Note: field name is `impact_if_wrong`, not `impact_if_unresolved`. */
  critical_unknowns: Array<{
    question: string;
    impact_if_wrong: string;
  }>;

  red_flags: RedFlag[];

  /** 0–100. Sum of problem_strength_breakdown scores. */
  problem_strength_score: number;
  problem_strength_breakdown: {
    pain_intensity:                ScoreDimension; // max 30
    frequency:                     ScoreDimension; // max 20
    user_specificity:              ScoreDimension; // max 20
    evidence_quality:              ScoreDimension; // max 20
    urgency_and_willingness_to_pay: ScoreDimension; // max 10
  };

  reasoning: string[];
  recommended_next_steps: RecommendedAction[];
}

// ═════════════════════════════════════════════════════════════════════════════
// AGENT 2 — RESEARCH AGENT
// Skills: market-analysis, competitor-analysis
// Reads:  define_output
// Writes: market_analysis_output, competitor_analysis_output
// ═════════════════════════════════════════════════════════════════════════════

// ── Market Analysis ──────────────────────────────────────────────────────────

export type MarketAnalysisStatus = 'complete' | 'blocked_by_define' | 'insufficient_data';
export type MarketTimingClass    = 'too_early' | 'optimal' | 'competitive_window_closing' | 'too_late' | 'unknown';
export type Concentration        = 'fragmented' | 'moderately_concentrated' | 'concentrated';
export type SizingMethod         = 'top_down' | 'bottom_up' | 'value_based' | 'none';
export type EstimateConfidence   = 'high' | 'medium' | 'low' | 'none';
export type SegmentSize          = 'large' | 'medium' | 'small' | 'unknown';
export type PurchaseAuthority    = 'self' | 'team_budget' | 'enterprise_procurement' | 'unknown';
export type DemandSignalType     = 'direct_behavioral' | 'proxy' | 'synthetic';
export type SignalStrength        = 'strong' | 'moderate' | 'weak';
export type WTPTier              = 'behavioral' | 'stated' | 'analogous' | 'none';
export type PricingModel         = 'per_seat' | 'usage' | 'flat' | 'transaction' | 'unknown';
export type BuyerProcess         = 'self_serve' | 'team_evaluation' | 'enterprise_procurement' | 'unknown';
export type UrgencyTrajectory    = 'accelerating' | 'stable' | 'decelerating' | 'unknown';
export type MarketClaimClass     = 'sourced' | 'estimated' | 'assumed';

export type MarketEvidenceSource =
  | 'industry_report'
  | 'behavioral_data'
  | 'analogous_market'
  | 'founder_assertion'
  | 'inferred'
  | 'none';

export type MarketAssumption = Assumption & { evidence_source: MarketEvidenceSource };
export type MarketCriticalUnknown = CriticalUnknown & { blocks_downstream: boolean };

export interface ResearchAgentInput {
  define_output: DefineOutput;
  founder_brief?: string;
  prior_market_data?: string;
  /** Defaults to global if omitted. */
  geography?: string;
}

export interface MarketAnalysisOutput {
  agent: 'market-analysis';
  analysis_status: MarketAnalysisStatus;
  /** 0–100. */
  confidence: number;
  upstream_dependency_risk: string;

  /** One sentence derived from define_output. Must not expand the user/problem scope. */
  market_definition: string;

  /** Exactly one entry must have is_beachhead === true. */
  customer_segments: Array<{
    name: string;
    description: string;
    relative_size: SegmentSize;
    purchase_authority: PurchaseAuthority;
    pain_intensity_inherited: 'critical' | 'significant' | 'moderate' | 'minor' | 'unknown';
    is_beachhead: boolean;
  }>;

  market_size: {
    tam: {
      estimate: string;
      methodology: SizingMethod;
      source: string;
      confidence_in_estimate: EstimateConfidence;
    };
    sam: {
      estimate: string;
      constraints_applied: string[];
      methodology: SizingMethod;
      source: string;
      confidence_in_estimate: EstimateConfidence;
    };
    som: {
      estimate: string;
      timeframe_years: number;
      basis: string;
      confidence_in_estimate: EstimateConfidence;
    };
  };

  demand_signals: Array<{
    signal: string;
    type: DemandSignalType;
    source: string;
    strength: SignalStrength;
    what_it_indicates: string;
  }>;

  willingness_to_pay: Array<{
    segment: string;
    evidence_tier: WTPTier;
    evidence_detail: string;
    /** Empty string when evidence_tier === 'none'. */
    price_range_low: string;
    /** Empty string when evidence_tier === 'none'. */
    price_range_high: string;
    pricing_model: PricingModel;
    confidence: EstimateConfidence;
  }>;

  market_timing: {
    classification: MarketTimingClass;
    enabling_conditions: string[];
    timing_risks: string[];
    urgency_trajectory: UrgencyTrajectory;
    basis: string;
  };

  market_structure: {
    concentration: Concentration;
    dominant_players: string[];
    switching_costs: Friction;
    distribution_control: string;
    buyer_decision_process: BuyerProcess;
    regulatory_constraints: string;
  };

  /** 0–100. Sum of market_attractiveness_breakdown scores. */
  market_attractiveness_score: number;
  market_attractiveness_breakdown: {
    market_size:           ScoreDimension; // max 25
    growth_trajectory:     ScoreDimension; // max 20
    demand_signal_quality: ScoreDimension; // max 20
    willingness_to_pay:    ScoreDimension; // max 20
    market_timing:         ScoreDimension; // max 15
  };

  /** Audit trail consumed by the Verification Agent. */
  market_claims: Array<{
    claim: string;
    classification: MarketClaimClass;
    source_or_methodology: string;
    evidence_detail: string;
  }>;

  assumptions: MarketAssumption[];
  critical_unknowns: MarketCriticalUnknown[];
  red_flags: RedFlag[];
  reasoning: string[];
  recommended_research: RecommendedAction[];
}

// ── Competitor Analysis ───────────────────────────────────────────────────────

export type CompetitorType      = 'direct' | 'indirect' | 'workaround';
export type UserOverlap         = 'high' | 'medium' | 'low' | 'unknown';
export type ProblemCoverage     = 'full' | 'partial' | 'incidental';
export type MarketPosition      = 'dominant' | 'established' | 'emerging' | 'niche' | 'unknown';
export type WeaknessType        = 'structural' | 'tactical' | 'unknown';
export type ComplaintFrequency  = 'pervasive' | 'common' | 'occasional' | 'isolated' | 'unknown';
export type SwitchingDriver     = 'data_migration' | 'workflow_disruption' | 'contract_lock' | 'habit' | 'integration_dependency' | 'unknown';
export type IncumbentRisk       = 'critical' | 'moderate' | 'low' | 'unknown';
export type Defensibility       = 'structural' | 'tactical' | 'unknown';
export type CopyTimeline        = 'immediate' | 'within_6_months' | 'within_2_years' | 'unlikely' | 'unknown';
export type CompClaimClass      = 'sourced' | 'observed' | 'inferred';
export type ComplaintSourceType = 'user_review_platform' | 'user_forum' | 'support_thread' | 'inferred';

/** Valid for competitor strengths. Not valid for weaknesses — use CompetitorWeaknessSource. */
export type CompetitorStrengthSource =
  | 'user_review_platform'
  | 'user_forum'
  | 'product_observation'
  | 'analyst_report'
  | 'competitor_marketing'
  | 'inferred';

/** competitor_marketing is excluded: never valid as a weakness evidence source. */
export type CompetitorWeaknessSource = Exclude<CompetitorStrengthSource, 'competitor_marketing'>;

export type CompetitorAssumptionSource =
  | 'user_review_platform'
  | 'user_forum'
  | 'analyst_report'
  | 'product_observation'
  | 'founder_assertion'
  | 'inferred'
  | 'none';

export type CompetitorAssumption = Assumption & { evidence_source: CompetitorAssumptionSource };
export type CompetitorCriticalUnknown = CriticalUnknown & { blocks_downstream: boolean };

export interface CompetitorAnalysisOutput {
  agent: 'competitor-analysis';
  analysis_status: 'complete' | 'blocked_by_define' | 'insufficient_data';
  /** 0–100. */
  confidence: number;
  upstream_dependency_risk: string;
  /** One sentence derived from define_output. */
  competitive_scope: string;

  /** At minimum one entry with type === 'workaround' is required. */
  competitors: Array<{
    name: string;
    type: CompetitorType;
    description: string;
    target_user_overlap: UserOverlap;
    problem_coverage: ProblemCoverage;
    market_position: MarketPosition;
    traction_signal: string;
    strengths: Array<{
      claim: string;
      evidence_source: CompetitorStrengthSource;
      evidence_detail: string;
    }>;
    weaknesses: Array<{
      claim: string;
      /** competitor_marketing is excluded at the type level. */
      evidence_source: CompetitorWeaknessSource;
      evidence_detail: string;
      weakness_type: WeaknessType;
    }>;
    user_complaints: Array<{
      complaint: string;
      source_type: ComplaintSourceType;
      source_detail: string;
      frequency: ComplaintFrequency;
    }>;
    switching_cost: {
      overall: Friction;
      primary_driver: SwitchingDriver;
      basis: string;
    };
    incumbent_response: {
      capability: 'high' | 'medium' | 'low' | 'unknown';
      incentive: 'high' | 'medium' | 'low' | 'unknown';
      overall_risk: IncumbentRisk;
      basis: string;
    };
  }>;

  /** Complaints / weaknesses that span multiple competitors. Not differentiation opportunities. */
  category_wide_gaps: Array<{
    gap: string;
    /** Competitor names. */
    appears_in: string[];
    implication: string;
  }>;

  differentiation_opportunities: Array<{
    opportunity: string;
    /** Must reference specific user_complaints entries; never empty. */
    source_complaints: string[];
    exploits_competitor: string;
    defensibility: Defensibility;
    /** Required; never empty. */
    defensibility_basis: string;
    incumbent_can_copy: boolean;
    incumbent_copy_timeline: CopyTimeline;
  }>;

  /** 0–100. Higher = more favorable for a new entrant. */
  landscape_score: number;
  landscape_score_breakdown: {
    incumbent_vulnerability:      ScoreDimension; // max 25
    switching_cost_manageability: ScoreDimension; // max 20
    differentiation_clarity:      ScoreDimension; // max 20
    incumbent_response_risk:      ScoreDimension; // max 20
    workaround_quality:           ScoreDimension; // max 15
  };

  /** Audit trail consumed by the Verification Agent. */
  competitive_claims: Array<{
    claim: string;
    about_competitor: string;
    classification: CompClaimClass;
    source_detail: string;
  }>;

  assumptions: CompetitorAssumption[];
  critical_unknowns: CompetitorCriticalUnknown[];
  red_flags: RedFlag[];
  reasoning: string[];
  recommended_research: RecommendedAction[];
}

// ═════════════════════════════════════════════════════════════════════════════
// AGENT 3 — STRATEGY AGENT
// Skill: mvp-planning
// Reads:  define_output, market_analysis_output, competitor_analysis_output
// Writes: mvp_planning_output
// ═════════════════════════════════════════════════════════════════════════════

export type AssumptionLayer =
  | 'value'              // layer 1: problem is real and painful enough to change behavior
  | 'demand'             // layer 2: enough users exist for economic viability
  | 'willingness_to_pay' // layer 3: users will complete a financial transaction
  | 'retention'          // layer 4: users return after initial adoption
  | 'solution';          // layer 5: this specific solution beats alternatives

export type ExperimentType =
  | 'problem_interview'
  | 'demand_test'
  | 'willingness_to_pay_test'
  | 'concierge_mvp'
  | 'wizard_of_oz'
  | 'prototype_test'
  /** Most expensive. All cheaper types must appear in lower_cost_options_ruled_out. */
  | 'functional_mvp';

export type PivotDirection =
  | 'abandon'
  | 'reframe_problem'
  | 'change_segment'
  | 'change_business_model'
  | 'change_solution_approach'
  | 'change_channel';

export type StrategyEvidenceSource =
  | 'user_interview'
  | 'behavioral_data'
  | 'analogous_case'
  | 'founder_self_report'
  | 'inferred'
  | 'none';

export type StrategyAssumption = Assumption & { evidence_source: StrategyEvidenceSource };
export type StrategyCriticalUnknown = CriticalUnknown & { blocks_experiment: boolean };

export interface StrategyAgentInput {
  define_output: DefineOutput;
  market_analysis_output: MarketAnalysisOutput;
  competitor_analysis_output: CompetitorAnalysisOutput;
  founder_constraints?: {
    budget?: string;
    timeline_days?: number;
    team_size?: number;
  };
  founder_brief?: string;
  /** Populated on loop iterations only; passed from the Critic Agent via the orchestrator. */
  required_revisions?: VerificationOutput['required_revisions'];
}

export interface MvpPlanningOutput {
  agent: 'mvp-planning';
  analysis_status: 'complete' | 'blocked_by_define' | 'insufficient_upstream_data';
  /** 0–100. */
  confidence: number;
  upstream_dependency_risk: string;

  /**
   * true when the experiment tests layer 5 (solution) while layers 1–3 contain
   * unvalidated assumptions. Critical red flag; caps confidence at 50.
   */
  assumption_inversion_detected: boolean;

  core_assumption: {
    statement: string;
    layer: AssumptionLayer;
    /** Reference to define_output.assumptions[n].claim or critical_unknowns[n].question. */
    source_in_define_output: string;
    why_highest_risk: string;
  };

  /** Covers all five layers. Exactly one entry has is_core_target === true. */
  assumption_stack: Array<{
    assumption: string;
    layer: AssumptionLayer;
    validation_status: 'validated' | 'unvalidated' | 'unknown';
    evidence_basis: string;
    is_core_target: boolean;
  }>;

  experiment: {
    type: ExperimentType;
    type_rationale: string;
    /** Every type cheaper than the selected one must appear here with a reason. */
    lower_cost_options_ruled_out: Array<{
      type: ExperimentType;
      reason_excluded: string;
    }>;
    /** One sentence; derived from market_analysis beachhead segment. */
    beachhead_user: string;
    /** Required. 0 is a contract violation. */
    time_bound_days: number;
    /** Required. 'unknown' triggers a critical_unknown entry. */
    resource_bound: string;
  };

  scope: {
    in_scope: Array<{
      element: string;
      assumption_layer_tested: AssumptionLayer;
      /** Specific observable action — not "users will find it useful". */
      user_behavior_required: string;
      justification: string;
    }>;
    /** Must be non-empty; empty list signals scope has not been pressure-tested. */
    out_of_scope: Array<{
      element: string;
      reason: string;
    }>;
  };

  success_criteria: Array<{
    criterion: string;
    measurement_method: string;
    timeframe_days: number;
    minimum_sample_size: number;
    layer_validated: AssumptionLayer;
    /** Must be true. Attitudinal criteria are a contract violation. */
    is_behavioral: boolean;
    /** Must be true. */
    is_pre_committed: boolean;
  }>;

  pivot_triggers: Array<{
    condition: string;
    timeframe_days: number;
    implied_direction: PivotDirection;
  }>;

  /** Must contain at least one false_positive and one false_negative entry. */
  validation_risks: Array<{
    risk_type: 'false_positive' | 'false_negative';
    description: string;
    mitigation: string;
  }>;

  /** 0–100. Sum of mvp_feasibility_breakdown scores. */
  mvp_feasibility_score: number;
  mvp_feasibility_breakdown: {
    assumption_clarity:         ScoreDimension; // max 25
    experiment_design:          ScoreDimension; // max 25
    success_criteria_quality:   ScoreDimension; // max 20
    time_to_learning:           ScoreDimension; // max 15
    validation_risk_management: ScoreDimension; // max 15
  };

  assumptions: StrategyAssumption[];
  critical_unknowns: StrategyCriticalUnknown[];
  red_flags: RedFlag[];
  reasoning: string[];
  recommended_next_actions: Array<{
    action: string;
    expected_learning: string;
    effort: Effort;
    /** Integer; 1 = highest priority. */
    priority: number;
  }>;
}

// ═════════════════════════════════════════════════════════════════════════════
// AGENT 4 — CRITIC AGENT
// Skill: verification
// Reads:  all prior outputs + loop_count
// Writes: verification_output
// ═════════════════════════════════════════════════════════════════════════════

export type Verdict      = 'approve' | 'revise' | 'reject';
export type FindingType  =
  | 'hallucination'
  | 'assumption_laundering'
  | 'unsupported_claim'
  | 'circular_reasoning'
  | 'optimism_bias'
  | 'confidence_miscalibration'
  | 'missing_risk'
  | 'contradiction'
  | 'problem_solution_mismatch';
export type FindingAction = 'block' | 'revise' | 'flag';

export interface CriticAgentInput {
  define_output: DefineOutput;
  market_analysis_output: MarketAnalysisOutput;
  competitor_analysis_output: CompetitorAnalysisOutput;
  mvp_planning_output: MvpPlanningOutput;
  /** 1 on first pass; maximum is 3. */
  loop_count: number;
  /** Required when loop_count > 1. */
  prior_verification_output?: VerificationOutput;
}

export interface VerificationOutput {
  agent: 'verification';
  analysis_status: 'complete' | 'incomplete_pipeline';
  loop_count: number;
  verdict: Verdict;
  /** 0–100. Certainty in this verification assessment. */
  confidence: number;
  /** 0–100. Primary routing signal. approve requires >= 75. */
  trustworthiness_score: number;

  pipeline_recommendation: {
    action: 'proceed_to_ceo' | 'return_to_strategy' | 'return_to_define';
    reason: string;
    loop_limit_reached: boolean;
    /** Must be non-empty when loop_limit_reached === true and issues remain. */
    ceo_caveats: string[];
  };

  agent_audits: Array<{
    /** One of 'define-problem' | 'research' | 'strategy'. */
    agent: string;
    integrity_score: number;
    integrity_score_basis: string;
    findings: Array<{
      type: FindingType;
      severity: Severity;
      claim: string;
      issue: string;
      pipeline_action: FindingAction;
    }>;
  }>;

  cross_agent_contradictions: Array<{
    agent_a: string;
    claim_a: string;
    agent_b: string;
    claim_b: string;
    severity: Severity;
    resolution_required: string;
  }>;

  assumption_chain: Array<{
    assumption: string;
    introduced_by: string;
    status_in_define: EvidenceStatus;
    laundered_in: string;
    treated_as: 'validated' | 'assumed';
    laundering_confirmed: boolean;
  }>;

  evidence_quality: {
    overall_score: number;
    claims_audited: number;
    validated_count: number;
    assumed_count: number;
    hallucinated_count: number;
    /** Must be non-empty when hallucinated_count > 0. */
    hallucinated_claims: string[];
  };

  risk_coverage: {
    bear_case_present: boolean;
    bear_case_quality: 'specific' | 'generic' | 'absent';
    identified_risk_categories: string[];
    missing_risk_categories: string[];
    risks_with_mitigation: number;
    risks_without_mitigation: number;
  };

  trustworthiness_breakdown: {
    evidence_integrity:      ScoreDimension; // max 30
    internal_consistency:    ScoreDimension; // max 20
    assumption_transparency: ScoreDimension; // max 20
    risk_completeness:       ScoreDimension; // max 15
    confidence_calibration:  ScoreDimension; // max 15
  };

  blocking_issues: Array<{
    issue: string;
    source_agent: string;
    reason_blocking: string;
  }>;

  required_revisions: Array<{
    target_agent: string;
    claim: string;
    issue: string;
    /** Actionable; must name the specific fix required. Never generic. */
    resolution: string;
    severity: Severity;
    /** Integer; 1 = must resolve first. */
    priority: number;
  }>;

  /**
   * Required and complete when loop_count > 1.
   * Every entry from the prior required_revisions must appear here.
   */
  prior_issues_resolved: Array<{
    issue: string;
    resolved: boolean;
    resolution_evidence: string;
  }>;

  reasoning: string[];
  critical_unknowns: Array<{
    question: string;
    impact_if_unresolved: string;
  }>;
}

// ═════════════════════════════════════════════════════════════════════════════
// AGENT 5 — CEO AGENT
// Skill: startup-validation
// Reads:  all prior outputs (verification_output is the trust gate)
// Writes: startup_validation_output
// This agent always produces output; it never halts the pipeline.
// ═════════════════════════════════════════════════════════════════════════════

export type BuildDecision     = 'PROCEED' | 'PROCEED WITH CAUTION' | 'DO NOT BUILD';
export type DecisionStatus    = 'complete' | 'pending_revision' | 'untrustworthy_analysis' | 'incomplete_pipeline';
export type TrustGateResult   = 'pass' | 'pass_with_caveats' | 'incomplete' | 'fail';
export type DecisionCeiling   = 'none' | 'PROCEED WITH CAUTION' | 'DO NOT BUILD';
export type DecisionDimension = 'user_pain' | 'market_potential' | 'competitive_advantage' | 'monetization' | 'mvp_feasibility' | 'execution_complexity';
export type CEOEvidenceQuality = 'validated' | 'mixed' | 'weak';

export type CEOEvidenceSource =
  | 'behavioral'
  | 'sourced'
  | 'validated'
  | 'stated'
  | 'analogous'
  | 'assumed'
  | 'inferred'
  | 'founder_self_report'
  | 'none';

export interface CEOAgentInput {
  define_output: DefineOutput;
  market_analysis_output: MarketAnalysisOutput;
  competitor_analysis_output: CompetitorAnalysisOutput;
  mvp_planning_output: MvpPlanningOutput;
  verification_output: VerificationOutput;
}

export interface StartupValidationOutput {
  agent: 'startup-validation';
  decision: BuildDecision;
  decision_status: DecisionStatus;
  /** 0–100. Dominated by verification_output.trustworthiness_score. */
  decision_confidence: number;

  trust_gate: {
    verification_verdict: Verdict | 'missing';
    gate_result: TrustGateResult;
    trustworthiness_score: number;
    decision_ceiling_imposed: DecisionCeiling;
    caveats_carried: string[];
  };

  /**
   * 0.0–10.0. Must equal the sum of all dimension_scores[].weighted_contribution values.
   *
   * Dimension weights:
   *   user_pain:             0.30  (source: define_output.problem_strength_score / 10)
   *   market_potential:      0.20  (source: market_analysis_output.market_attractiveness_score / 10)
   *   competitive_advantage: 0.15  (source: competitor_analysis_output.landscape_score / 10)
   *   monetization:          0.15  (source: market_analysis_output.willingness_to_pay[beachhead])
   *   mvp_feasibility:       0.10  (source: mvp_planning_output.mvp_feasibility_score / 10)
   *   execution_complexity:  0.10  (derived inverse; lower complexity = higher score)
   */
  weighted_composite: number;

  /** Rubric band from composite alone, before knockouts are applied. */
  rubric_band_provisional: BuildDecision;

  /** Exactly 6 entries; weights must sum to 1.0. */
  dimension_scores: Array<{
    dimension: DecisionDimension;
    /** 0–10. */
    score_0_10: number;
    weight: number;
    weighted_contribution: number;
    source_field: string;
    evidence_quality: CEOEvidenceQuality;
    /** Empty string if uncapped; otherwise names the cap rule applied. */
    cap_applied: string;
    /** Must be non-empty; references evidence_ledger[].id. */
    ledger_refs: string[];
  }>;

  /** All knockout rules that fired. Final decision = most restrictive cap across all entries. */
  knockouts_triggered: Array<{
    condition: string;
    decision_cap: Exclude<DecisionCeiling, 'none'>;
    evidence_basis: string;
  }>;

  /**
   * true when market_potential is the top-scoring dimension AND
   * (user_pain < 5 OR monetization < 5).
   * Must be accompanied by a knockout entry capping to 'PROCEED WITH CAUTION'.
   */
  market_size_carry_detected: boolean;

  /**
   * Traceability spine. Every load-bearing finding must appear here.
   * Stable IDs (e.g. 'EL-1') are referenced by dimension_scores[].ledger_refs
   * and decision_rationale.primary_factors[].ledger_ref.
   */
  evidence_ledger: Array<{
    /** Stable identifier, e.g. 'EL-1'. */
    id: string;
    dimension: DecisionDimension;
    finding: string;
    source_agent: string;
    source_field: string;
    evidence_source: CEOEvidenceSource;
    evidence_quality: CEOEvidenceQuality;
  }>;

  decision_rationale: {
    primary_factors: Array<{
      factor: string;
      direction: 'supports' | 'opposes';
      /** Must reference a valid evidence_ledger[].id. */
      ledger_ref: string;
    }>;
    /** Required; non-empty on every decision. */
    strongest_counterargument: string;
    /** Required when decision !== 'DO NOT BUILD'. */
    bear_case: string;
  };

  fastest_next_action: {
    action: string;
    expected_learning: string;
    /** PROCEED: cites mvp_planning_output.experiment; else names the gap that drove the decision. */
    source: string;
    effort: Effort;
  };

  build_recommendations: {
    /** Validation-scoped; derived from mvp_planning_output.scope.in_scope. */
    build: string[];
    /** Derived from mvp_planning_output.scope.out_of_scope. */
    avoid: string[];
    /** This literal string must remain unchanged. */
    note: 'Build/avoid items are validation-scoped from MVP Planning, not a product roadmap.';
  };

  open_risks: Array<{
    risk: string;
    severity: Severity;
    source_agent: string;
    mitigation_status: 'mitigated' | 'unmitigated' | 'unknown';
  }>;

  critical_unknowns: Array<{
    question: string;
    impact_on_decision: string;
    /** The specific answer that would flip the decision. */
    would_change_decision_if: string;
  }>;

  reasoning: string[];
}
