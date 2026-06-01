# Agent Contracts

Implementation reference for the BuildScore AI pipeline. Each contract defines what an agent consumes, what it produces, the conditions under which it halts or loops, and what constitutes a successful run. TypeScript interfaces are provided for direct use.

All agents emit structured JSON conforming to the shared base contract. The orchestrator validates this shape on receipt and will retry an agent once before halting if the shape is invalid.

---

## Quick Reference

| # | Agent | Phase | Skill(s) | Reads from pipeline_state | Writes to pipeline_state |
|---|-------|-------|----------|--------------------------|--------------------------|
| 1 | Define Agent | Define | `define-problem` | `founder_brief` | `define_output` |
| 2 | Research Agent | Do | `market-analysis`, `competitor-analysis` | `define_output` | `market_analysis_output`, `competitor_analysis_output` |
| 3 | Strategy Agent | Do | `mvp-planning` | `define_output`, `market_analysis_output`, `competitor_analysis_output` | `mvp_planning_output` |
| 4 | Critic Agent | Verify | `verification` | all prior outputs + `loop_count` | `verification_output` |
| 5 | CEO Agent | Verify | `startup-validation` | all prior outputs | `startup_validation_output` |

---

## Shared Types

These types are referenced by all agent interfaces. Define once; import everywhere.

```typescript
// ─── Primitive Enums ─────────────────────────────────────────────────────────

type AnalysisStatus =
  | 'complete'
  | 'insufficient_input'   // Define: idea too vague to analyze
  | 'blocked_by_define'    // Research/Strategy: Define output is insufficient
  | 'insufficient_data'    // Research: market data too thin
  | 'incomplete_pipeline'; // Verification/CEO: a required upstream output is missing

type EvidenceStatus = 'validated' | 'assumed' | 'unknown';

type Severity = 'critical' | 'major' | 'minor';

type PipelineAction = 'halt' | 'cap_confidence' | 'flag_only';

type Effort = 'low' | 'medium' | 'high';

type Friction = 'high' | 'medium' | 'low' | 'unknown';

// ─── Shared Structures ───────────────────────────────────────────────────────

interface Assumption {
  claim: string;
  status: EvidenceStatus;
  evidence_source: string; // enum varies by agent — see per-agent definition
  evidence_detail: string;
}

interface CriticalUnknown {
  question: string;
  impact_if_unresolved: string;
  blocks_downstream?: boolean; // present on Research, Strategy, Verification
}

interface RedFlag {
  type: string;
  description: string;
  severity: Severity;
  pipeline_action: PipelineAction;
}

interface RecommendedAction {
  action: string;
  expected_signal: string;
  effort: Effort;
  priority: number; // integer, 1 = highest
}

interface ScoreDimension {
  score: number;  // 0 to max
  max: number;
  basis: string;  // required; must not be empty
}
```

---

## Agent 1: Define Agent

### Purpose

Extracts and pressure-tests the real problem behind the founder's idea. Produces the problem definition, pain profile, and assumption inventory that all downstream agents reason from. Runs first; its output quality determines the ceiling of everything that follows.

### Dependencies

| Input | Source | Required |
|-------|--------|----------|
| `founder_brief` | Pipeline input (founder submission) | Yes |

No upstream agent output is consumed. This agent runs cold.

### Inputs

```typescript
interface DefineAgentInput {
  idea: string;               // founder's raw idea, in their own words
  target_user?: string;       // founder's belief about who the user is
  current_solutions?: string; // tools or behaviors founder is aware of
  founder_context?: string;   // is the founder the target user? domain background?
  prior_research?: string;    // any interviews, validation, or evidence gathered
}
```

### Output

```typescript
type PainType    = 'painkiller' | 'aspirin' | 'vitamin';
type Frequency   = 'daily' | 'weekly' | 'monthly' | 'rare' | 'unknown';
type Intensity   = 'critical' | 'significant' | 'moderate' | 'minor' | 'unknown';
type Awareness   = 'explicit' | 'latent' | 'unknown';
type Specificity = 'high' | 'medium' | 'low';
type Adequacy    = 'adequate' | 'poor' | 'none';

type DefineEvidenceSource =
  | 'external_interview'
  | 'usage_data'
  | 'third_party_research'
  | 'founder_self_report'
  | 'inferred'
  | 'none';

interface DefineOutput {
  agent: 'define-problem';
  analysis_status: 'complete' | 'insufficient_input';
  confidence: number;           // 0–100; certainty in the problem definition

  neutral_restatement: string;           // idea rewritten with solution language removed
  initial_problem_statement: string;     // extracted in step 2, before testing
  problem_statement: string;             // final version after root-cause testing
  problem_statement_revised: boolean;
  problem_statement_revision_reason: string;
  why_now: string;                       // required; 'unknown' is valid

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
    type_basis: string;          // required; evidence for painkiller/aspirin/vitamin call
    frequency: Frequency;
    intensity: Intensity;
    emotional_cost: string;      // required; 'unknown' is valid
    awareness: Awareness;
    latent_validation_note: string; // required when awareness === 'latent'
  };

  status_quo: {
    current_solutions: Array<{
      name: string;
      adequacy: Adequacy;
    }>;
    failed_solutions: Array<{
      name: string;
      reason_for_failure: string;
    }>;
    switching_friction_from_current: Friction;
  };

  assumptions: Array<Assumption & { evidence_source: DefineEvidenceSource }>;

  critical_unknowns: Array<{
    question: string;
    impact_if_wrong: string;  // note: field name differs from shared type
  }>;

  red_flags: RedFlag[];

  problem_strength_score: number; // 0–100
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
```

### Failure Modes

| Condition | Pipeline Effect |
|-----------|----------------|
| `analysis_status === 'insufficient_input'` | Orchestrator **halts**. Returns `critical_unknowns` to founder. Research Agent does not run. |
| Output is non-conforming JSON | Orchestrator retries once. Second failure → **halt** with `halt_reason: 'contract_violation'`. |
| `confidence < 40` | Pipeline continues. Research Agent applies a confidence ceiling of 55 on its own outputs. |
| Any `red_flags[].pipeline_action === 'halt'` | Orchestrator evaluates halt action before passing to Research. |

### Success Criteria

- `analysis_status === 'complete'`
- `problem_statement` is non-empty and does not contain solution language
- `pain_profile.type_basis` is non-empty
- `pain_profile.emotional_cost` is non-empty
- `why_now` is non-empty
- `problem_strength_score` is a number in [0, 100]
- All `problem_strength_breakdown` dimensions have non-empty `basis` strings

---

## Agent 2: Research Agent

### Purpose

Evaluates whether a meaningful, attractive market exists around the defined problem, and maps the full competitive landscape — every product, partial solution, and workaround users currently rely on. Produces two separate outputs consumed by the Strategy Agent and the CEO Agent's scoring framework.

### Dependencies

| Input | Source | Required |
|-------|--------|----------|
| `define_output` | Define Agent | Yes |
| `founder_brief` | Pipeline input | Optional |
| `prior_market_data` | Pipeline input | Optional |
| `geography` | Pipeline input | Optional (defaults to global) |

### Inputs

```typescript
interface ResearchAgentInput {
  define_output: DefineOutput;
  founder_brief?: string;
  prior_market_data?: string;
  geography?: string;
}
```

### Output — Market Analysis

```typescript
type MarketAnalysisStatus  = 'complete' | 'blocked_by_define' | 'insufficient_data';
type MarketTimingClass     = 'too_early' | 'optimal' | 'competitive_window_closing' | 'too_late' | 'unknown';
type Concentration         = 'fragmented' | 'moderately_concentrated' | 'concentrated';
type SizingMethod          = 'top_down' | 'bottom_up' | 'value_based' | 'none';
type EstimateConfidence    = 'high' | 'medium' | 'low' | 'none';
type SegmentSize           = 'large' | 'medium' | 'small' | 'unknown';
type PurchaseAuthority     = 'self' | 'team_budget' | 'enterprise_procurement' | 'unknown';
type DemandSignalType      = 'direct_behavioral' | 'proxy' | 'synthetic';
type SignalStrength         = 'strong' | 'moderate' | 'weak';
type WTPTier               = 'behavioral' | 'stated' | 'analogous' | 'none';
type PricingModel          = 'per_seat' | 'usage' | 'flat' | 'transaction' | 'unknown';
type BuyerProcess          = 'self_serve' | 'team_evaluation' | 'enterprise_procurement' | 'unknown';
type UrgencyTrajectory     = 'accelerating' | 'stable' | 'decelerating' | 'unknown';
type MarketClaimClass      = 'sourced' | 'estimated' | 'assumed';

type MarketEvidenceSource =
  | 'industry_report'
  | 'behavioral_data'
  | 'analogous_market'
  | 'founder_assertion'
  | 'inferred'
  | 'none';

interface MarketAnalysisOutput {
  agent: 'market-analysis';
  analysis_status: MarketAnalysisStatus;
  confidence: number;           // 0–100
  upstream_dependency_risk: string;

  market_definition: string;   // one sentence derived from define_output

  customer_segments: Array<{
    name: string;
    description: string;
    relative_size: SegmentSize;
    purchase_authority: PurchaseAuthority;
    pain_intensity_inherited: 'critical' | 'significant' | 'moderate' | 'minor' | 'unknown';
    is_beachhead: boolean;      // exactly one segment must be true
  }>;

  market_size: {
    tam: { estimate: string; methodology: SizingMethod; source: string; confidence_in_estimate: EstimateConfidence; };
    sam: { estimate: string; constraints_applied: string[]; methodology: SizingMethod; source: string; confidence_in_estimate: EstimateConfidence; };
    som: { estimate: string; timeframe_years: number; basis: string; confidence_in_estimate: EstimateConfidence; };
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
    price_range_low: string;    // empty string when evidence_tier === 'none'
    price_range_high: string;   // empty string when evidence_tier === 'none'
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

  market_attractiveness_score: number; // 0–100
  market_attractiveness_breakdown: {
    market_size:           ScoreDimension; // max 25
    growth_trajectory:     ScoreDimension; // max 20
    demand_signal_quality: ScoreDimension; // max 20
    willingness_to_pay:    ScoreDimension; // max 20
    market_timing:         ScoreDimension; // max 15
  };

  market_claims: Array<{
    claim: string;
    classification: MarketClaimClass;
    source_or_methodology: string;
    evidence_detail: string;
  }>;

  assumptions: Array<Assumption & { evidence_source: MarketEvidenceSource }>;
  critical_unknowns: Array<CriticalUnknown & { blocks_downstream: boolean }>;
  red_flags: RedFlag[];
  reasoning: string[];
  recommended_research: RecommendedAction[];
}
```

### Output — Competitor Analysis

```typescript
type CompetitorType      = 'direct' | 'indirect' | 'workaround';
type UserOverlap         = 'high' | 'medium' | 'low' | 'unknown';
type ProblemCoverage     = 'full' | 'partial' | 'incidental';
type MarketPosition      = 'dominant' | 'established' | 'emerging' | 'niche' | 'unknown';
type WeaknessType        = 'structural' | 'tactical' | 'unknown';
type ComplaintFrequency  = 'pervasive' | 'common' | 'occasional' | 'isolated' | 'unknown';
type SwitchingDriver     = 'data_migration' | 'workflow_disruption' | 'contract_lock' | 'habit' | 'integration_dependency' | 'unknown';
type IncumbentRisk       = 'critical' | 'moderate' | 'low' | 'unknown';
type Defensibility       = 'structural' | 'tactical' | 'unknown';
type CopyTimeline        = 'immediate' | 'within_6_months' | 'within_2_years' | 'unlikely' | 'unknown';
type CompClaimClass      = 'sourced' | 'observed' | 'inferred';
type ComplaintSourceType = 'user_review_platform' | 'user_forum' | 'support_thread' | 'inferred';

type CompetitorStrengthSource =
  | 'user_review_platform'
  | 'user_forum'
  | 'product_observation'
  | 'analyst_report'
  | 'competitor_marketing' // valid for strengths only — never for weaknesses
  | 'inferred';

type CompetitorWeaknessSource = Exclude<CompetitorStrengthSource, 'competitor_marketing'>;

type CompetitorAssumptionSource =
  | 'user_review_platform'
  | 'user_forum'
  | 'analyst_report'
  | 'product_observation'
  | 'founder_assertion'
  | 'inferred'
  | 'none';

interface CompetitorAnalysisOutput {
  agent: 'competitor-analysis';
  analysis_status: 'complete' | 'blocked_by_define' | 'insufficient_data';
  confidence: number;
  upstream_dependency_risk: string;
  competitive_scope: string;  // one sentence derived from define_output

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

  category_wide_gaps: Array<{
    gap: string;
    appears_in: string[];  // competitor names
    implication: string;
  }>;

  differentiation_opportunities: Array<{
    opportunity: string;
    source_complaints: string[];   // must reference user_complaints entries; never empty
    exploits_competitor: string;
    defensibility: Defensibility;
    defensibility_basis: string;   // required; never empty
    incumbent_can_copy: boolean;
    incumbent_copy_timeline: CopyTimeline;
  }>;

  landscape_score: number; // 0–100; higher = more favorable for new entrant
  landscape_score_breakdown: {
    incumbent_vulnerability:      ScoreDimension; // max 25
    switching_cost_manageability: ScoreDimension; // max 20
    differentiation_clarity:      ScoreDimension; // max 20
    incumbent_response_risk:      ScoreDimension; // max 20
    workaround_quality:           ScoreDimension; // max 15
  };

  competitive_claims: Array<{
    claim: string;
    about_competitor: string;
    classification: CompClaimClass;
    source_detail: string;
  }>;

  assumptions: Array<Assumption & { evidence_source: CompetitorAssumptionSource }>;
  critical_unknowns: Array<CriticalUnknown & { blocks_downstream: boolean }>;
  red_flags: RedFlag[];
  reasoning: string[];
  recommended_research: RecommendedAction[];
}
```

### Failure Modes

| Condition | Pipeline Effect |
|-----------|----------------|
| `market_analysis_output.analysis_status === 'blocked_by_define'` | Orchestrator **halts**. Returns Define Agent's `critical_unknowns` to founder. |
| `competitor_analysis_output.analysis_status === 'blocked_by_define'` | Orchestrator **halts**. Same as above. |
| Either output is non-conforming JSON | Retry the failing skill once. Second failure → **halt** with `halt_reason: 'contract_violation'`. |
| `define_output.confidence < 40` | Both skills apply a confidence ceiling of 55 on their own outputs and set `upstream_dependency_risk`. Pipeline continues. |
| `define_output.target_user.primary.specificity === 'low'` | Both skills apply a confidence ceiling of 50. Pipeline continues with flagged risk. |
| `market_size.*methodology === 'none'` on a numeric claim | Verification Agent will flag as hallucination risk. Claim audit-trailed via `market_claims[]`. |
| `competitors[]` is empty | Contract violation: at minimum, workarounds must be documented. |

### Success Criteria

**Market Analysis:**
- `analysis_status === 'complete'`
- Exactly one `customer_segments[]` entry has `is_beachhead === true`
- `market_attractiveness_score` is a number in [0, 100]
- All `market_attractiveness_breakdown` dimensions have non-empty `basis` strings
- All `willingness_to_pay[]` entries have a non-empty `evidence_tier`
- All `market_claims[]` entries have a `classification` value

**Competitor Analysis:**
- `analysis_status === 'complete'`
- `competitors[]` is non-empty; at minimum one entry with `type === 'workaround'`
- All `differentiation_opportunities[]` entries have non-empty `defensibility_basis`
- All `differentiation_opportunities[]` entries have non-empty `source_complaints[]`
- `landscape_score` is a number in [0, 100]
- All `landscape_score_breakdown` dimensions have non-empty `basis` strings

---

## Agent 3: Strategy Agent

### Purpose

Determines the smallest experiment that can validate the highest-risk assumption behind the opportunity. Produces the core assumption, the validation experiment design, the minimal in-scope/out-of-scope breakdown, pre-committed success criteria, and pivot triggers. Does not design a full product — only the fastest path to evidence.

### Dependencies

| Input | Source | Required |
|-------|--------|----------|
| `define_output` | Define Agent | Yes |
| `market_analysis_output` | Research Agent | Yes |
| `competitor_analysis_output` | Research Agent | Yes |
| `founder_constraints` | Pipeline input | Optional |
| `founder_brief` | Pipeline input | Optional |
| `verification_output.required_revisions[]` | Critic Agent | On loop iterations only |

### Inputs

```typescript
interface StrategyAgentInput {
  define_output: DefineOutput;
  market_analysis_output: MarketAnalysisOutput;
  competitor_analysis_output: CompetitorAnalysisOutput;
  founder_constraints?: {
    budget?: string;
    timeline_days?: number;
    team_size?: number;
  };
  founder_brief?: string;
  required_revisions?: VerificationOutput['required_revisions']; // loop iterations only
}
```

### Output

```typescript
type AssumptionLayer =
  | 'value'              // layer 1: problem is real and painful enough to change behavior
  | 'demand'             // layer 2: enough users exist for economic viability
  | 'willingness_to_pay' // layer 3: users will complete a financial transaction
  | 'retention'          // layer 4: users return after initial adoption
  | 'solution';          // layer 5: this specific solution beats alternatives

type ExperimentType =
  | 'problem_interview'
  | 'demand_test'
  | 'willingness_to_pay_test'
  | 'concierge_mvp'
  | 'wizard_of_oz'
  | 'prototype_test'
  | 'functional_mvp';    // most expensive; all cheaper types must be ruled out

type PivotDirection =
  | 'abandon'
  | 'reframe_problem'
  | 'change_segment'
  | 'change_business_model'
  | 'change_solution_approach'
  | 'change_channel';

type StrategyEvidenceSource =
  | 'user_interview'
  | 'behavioral_data'
  | 'analogous_case'
  | 'founder_self_report'
  | 'inferred'
  | 'none';

interface MvpPlanningOutput {
  agent: 'mvp-planning';
  analysis_status: 'complete' | 'blocked_by_define' | 'insufficient_upstream_data';
  confidence: number;
  upstream_dependency_risk: string;

  assumption_inversion_detected: boolean;
  // true when experiment targets layer 5 while layers 1-3 contain unvalidated assumptions
  // critical red flag; caps confidence at 50; Critic Agent will audit

  core_assumption: {
    statement: string;
    layer: AssumptionLayer;
    source_in_define_output: string; // reference to define_output.assumptions[n] or critical_unknowns[n]
    why_highest_risk: string;
  };

  assumption_stack: Array<{
    assumption: string;
    layer: AssumptionLayer;
    validation_status: 'validated' | 'unvalidated' | 'unknown';
    evidence_basis: string;
    is_core_target: boolean; // true on exactly one entry
  }>;

  experiment: {
    type: ExperimentType;
    type_rationale: string;
    lower_cost_options_ruled_out: Array<{
      type: ExperimentType;
      reason_excluded: string;
    }>;
    beachhead_user: string;  // one sentence; derived from market_analysis beachhead segment
    time_bound_days: number; // required; 0 is a contract violation
    resource_bound: string;  // required; 'unknown' triggers a critical_unknown entry
  };

  scope: {
    in_scope: Array<{
      element: string;
      assumption_layer_tested: AssumptionLayer;
      user_behavior_required: string; // specific action required, not "users will find it useful"
      justification: string;
    }>;
    out_of_scope: Array<{
      element: string;
      reason: string;
    }>;
    // out_of_scope must be non-empty; an empty list signals scope has not been pressure-tested
  };

  success_criteria: Array<{
    criterion: string;
    measurement_method: string;
    timeframe_days: number;
    minimum_sample_size: number;
    layer_validated: AssumptionLayer;
    is_behavioral: boolean;    // must be true; attitudinal criteria are a contract violation
    is_pre_committed: boolean; // must be true
  }>;

  pivot_triggers: Array<{
    condition: string;
    timeframe_days: number;
    implied_direction: PivotDirection;
  }>;

  validation_risks: Array<{
    risk_type: 'false_positive' | 'false_negative';
    description: string;
    mitigation: string;
  }>;
  // must contain at least one false_positive and one false_negative entry

  mvp_feasibility_score: number; // 0–100
  mvp_feasibility_breakdown: {
    assumption_clarity:         ScoreDimension; // max 25
    experiment_design:          ScoreDimension; // max 25
    success_criteria_quality:   ScoreDimension; // max 20
    time_to_learning:           ScoreDimension; // max 15
    validation_risk_management: ScoreDimension; // max 15
  };

  assumptions: Array<Assumption & { evidence_source: StrategyEvidenceSource }>;
  critical_unknowns: Array<CriticalUnknown & { blocks_experiment: boolean }>;
  red_flags: RedFlag[];
  reasoning: string[];
  recommended_next_actions: Array<{
    action: string;
    expected_learning: string;
    effort: Effort;
    priority: number;
  }>;
}
```

### Failure Modes

| Condition | Pipeline Effect |
|-----------|----------------|
| `assumption_inversion_detected === true` | Red flag emitted; confidence capped at 50. Critic Agent audits. Pipeline continues. |
| `experiment.time_bound_days === 0` | Contract violation — Strategy must emit a non-zero value. |
| Any `success_criteria[].is_behavioral === false` | Critical red flag. Critic Agent will flag and return to Strategy. |
| `scope.out_of_scope` is empty | Confidence capped at 55. Critic audits. |
| `experiment.type === 'functional_mvp'` with empty `lower_cost_options_ruled_out` | Confidence capped at 40. Critic flags. |
| Output is non-conforming JSON | Retry once. Second failure → **halt** with `halt_reason: 'contract_violation'`. |

### Success Criteria

- `analysis_status === 'complete'`
- `assumption_inversion_detected === false`
- `core_assumption.source_in_define_output` is non-empty
- Exactly one `assumption_stack[]` entry has `is_core_target === true`
- `experiment.time_bound_days > 0`
- `scope.out_of_scope` is non-empty
- All `success_criteria[].is_behavioral === true`
- All `success_criteria[].is_pre_committed === true`
- `validation_risks[]` contains at least one `'false_positive'` and one `'false_negative'` entry
- `mvp_feasibility_score` is a number in [0, 100]

---

## Agent 4: Critic Agent

### Purpose

Audits the entire upstream pipeline for hallucinations, assumption laundering, contradictions, weak reasoning, optimism bias, and miscalibrated confidence. Produces a trust verdict that gates the CEO Agent. If the pipeline has not converged to a trustworthy analysis, returns it to the Strategy Agent for revision — up to a maximum of 3 passes total.

### Dependencies

| Input | Source | Required |
|-------|--------|----------|
| `define_output` | Define Agent | Yes |
| `market_analysis_output` | Research Agent | Yes |
| `competitor_analysis_output` | Research Agent | Yes |
| `mvp_planning_output` | Strategy Agent | Yes |
| `loop_count` | Orchestrator | Yes (integer; 1 on first pass) |
| `prior_verification_output` | Previous Critic pass | Required when `loop_count > 1` |

### Inputs

```typescript
interface CriticAgentInput {
  define_output: DefineOutput;
  market_analysis_output: MarketAnalysisOutput;
  competitor_analysis_output: CompetitorAnalysisOutput;
  mvp_planning_output: MvpPlanningOutput;
  loop_count: number;                         // 1, 2, or 3
  prior_verification_output?: VerificationOutput; // required when loop_count > 1
}
```

### Output

```typescript
type Verdict    = 'approve' | 'revise' | 'reject';
type FindingType =
  | 'hallucination'
  | 'assumption_laundering'
  | 'unsupported_claim'
  | 'circular_reasoning'
  | 'optimism_bias'
  | 'confidence_miscalibration'
  | 'missing_risk'
  | 'contradiction'
  | 'problem_solution_mismatch';
type FindingAction = 'block' | 'revise' | 'flag';

interface VerificationOutput {
  agent: 'verification';
  analysis_status: 'complete' | 'incomplete_pipeline';
  loop_count: number;
  verdict: Verdict;
  confidence: number;            // 0–100; certainty in this verification assessment
  trustworthiness_score: number; // 0–100; primary signal for routing; approve requires >= 75

  pipeline_recommendation: {
    action: 'proceed_to_ceo' | 'return_to_strategy' | 'return_to_define';
    reason: string;
    loop_limit_reached: boolean;
    ceo_caveats: string[]; // required non-empty when loop_limit_reached === true and issues remain
  };

  agent_audits: Array<{
    agent: string; // 'define-problem' | 'research' | 'strategy'
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
    hallucinated_claims: string[]; // must be non-empty when hallucinated_count > 0
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
    resolution: string;    // actionable; must name the specific fix required
    severity: Severity;
    priority: number;      // integer; 1 = must resolve first
  }>;

  prior_issues_resolved: Array<{
    issue: string;
    resolved: boolean;
    resolution_evidence: string;
  }>;
  // required and complete when loop_count > 1; must cover every prior required_revision

  reasoning: string[];
  critical_unknowns: Array<{
    question: string;
    impact_if_unresolved: string;
  }>;
}
```

### Routing Logic

```
verdict === 'approve'  (trustworthiness_score >= 75, no critical blocking_issues)
  └─► proceed to CEO Agent

verdict === 'approve' + loop_limit_reached === true
  └─► proceed to CEO Agent; ceo_caveats carries every unresolved minor issue

verdict === 'revise' + loop_count < 3
  └─► increment loop_count; return to Strategy Agent with required_revisions[]
       if any revision targets Research output: re-run affected Research skill first

verdict === 'revise' + loop_count === 3
  └─► loop limit reached; Critic re-evaluates:
       only minor issues remain → set verdict 'approve' + loop_limit_reached true
       major/critical issues remain → set verdict 'reject'

verdict === 'reject' + action === 'return_to_define'
  └─► orchestrator HALTS; returns to founder; problem definition must be rebuilt from scratch

verdict === 'reject' (other actions)
  └─► proceed to CEO Agent with trust-gate failure; decision will be DO NOT BUILD
```

### Failure Modes

| Condition | Pipeline Effect |
|-----------|----------------|
| `analysis_status === 'incomplete_pipeline'` | Missing required input — orchestration bug. Should not have been reached. `halt_reason: 'missing_input'`. |
| `verdict === 'reject'` + `action === 'return_to_define'` | Orchestrator **halts** to founder. Not a loop trigger. |
| `verdict === 'approve'` but `blocking_issues[]` has a critical entry | Contract violation — verdict must be `'revise'` or `'reject'`. |
| `prior_issues_resolved` is empty when `loop_count > 1` | Contract violation. Every prior revision must be accounted for. |
| `trustworthiness_breakdown` dimensions do not sum to `trustworthiness_score` | Contract violation. |
| Output is non-conforming JSON | Retry once. Second failure → **halt** with `halt_reason: 'contract_violation'`. |

### Success Criteria

- `verdict === 'approve'`
- `trustworthiness_score >= 75`
- `blocking_issues[]` contains no entries with `severity: 'critical'`
- When `loop_count > 1`: all prior `required_revisions[]` appear in `prior_issues_resolved[]`
- `evidence_quality.hallucinated_claims` is empty when `hallucinated_count === 0`
- All `required_revisions[].resolution` strings are non-empty and actionable
- `trustworthiness_breakdown` dimensions sum to `trustworthiness_score`

---

## Agent 5: CEO Agent

### Purpose

Synthesizes all upstream outputs into a single, evidence-traceable build decision — **PROCEED**, **PROCEED WITH CAUTION**, or **DO NOT BUILD** — applying the project's weighted scoring framework, the Verification trust gate, and knockout rules that prevent any single dimension (especially market size) from carrying the decision alone. This agent always produces output; it never halts the pipeline.

### Dependencies

| Input | Source | Required |
|-------|--------|----------|
| `define_output` | Define Agent | Yes |
| `market_analysis_output` | Research Agent | Yes |
| `competitor_analysis_output` | Research Agent | Yes |
| `mvp_planning_output` | Strategy Agent | Yes |
| `verification_output` | Critic Agent | Yes — the trust gate |

### Inputs

```typescript
interface CEOAgentInput {
  define_output: DefineOutput;
  market_analysis_output: MarketAnalysisOutput;
  competitor_analysis_output: CompetitorAnalysisOutput;
  mvp_planning_output: MvpPlanningOutput;
  verification_output: VerificationOutput;
}
```

### Output

```typescript
type BuildDecision     = 'PROCEED' | 'PROCEED WITH CAUTION' | 'DO NOT BUILD';
type DecisionStatus    = 'complete' | 'pending_revision' | 'untrustworthy_analysis' | 'incomplete_pipeline';
type TrustGateResult   = 'pass' | 'pass_with_caveats' | 'incomplete' | 'fail';
type DecisionCeiling   = 'none' | 'PROCEED WITH CAUTION' | 'DO NOT BUILD';
type DecisionDimension = 'user_pain' | 'market_potential' | 'competitive_advantage' | 'monetization' | 'mvp_feasibility' | 'execution_complexity';
type CEOEvidenceQuality = 'validated' | 'mixed' | 'weak';

type CEOEvidenceSource =
  | 'behavioral' | 'sourced' | 'validated'
  | 'stated' | 'analogous'
  | 'assumed' | 'inferred' | 'founder_self_report'
  | 'none';

interface StartupValidationOutput {
  agent: 'startup-validation';
  decision: BuildDecision;
  decision_status: DecisionStatus;
  decision_confidence: number; // 0–100; dominated by verification_output.trustworthiness_score

  trust_gate: {
    verification_verdict: Verdict | 'missing';
    gate_result: TrustGateResult;
    trustworthiness_score: number;
    decision_ceiling_imposed: DecisionCeiling;
    caveats_carried: string[];
  };

  weighted_composite: number; // 0.0–10.0; must equal sum of weighted_contribution values

  rubric_band_provisional: BuildDecision; // composite band before knockouts

  dimension_scores: Array<{
    dimension: DecisionDimension;
    score_0_10: number;
    weight: number;
    // weights: user_pain=0.30, market_potential=0.20, competitive_advantage=0.15,
    //          monetization=0.15, mvp_feasibility=0.10, execution_complexity=0.10
    weighted_contribution: number;
    source_field: string;
    evidence_quality: CEOEvidenceQuality;
    cap_applied: string;       // empty if uncapped; else names the rule
    ledger_refs: string[];     // references to evidence_ledger[].id; must be non-empty
  }>;

  knockouts_triggered: Array<{
    condition: string;
    decision_cap: Exclude<DecisionCeiling, 'none'>;
    evidence_basis: string;
  }>;

  market_size_carry_detected: boolean;
  // true when market_potential is top dimension AND (user_pain < 5 OR monetization < 5)
  // must be accompanied by a knockout entry capping to PROCEED WITH CAUTION

  evidence_ledger: Array<{
    id: string;                // stable identifier e.g. 'EL-1'; referenced by dimension_scores and rationale
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
      ledger_ref: string;    // must reference a valid evidence_ledger[].id
    }>;
    strongest_counterargument: string; // required; non-empty on every decision
    bear_case: string;                 // required when decision !== 'DO NOT BUILD'
  };

  fastest_next_action: {
    action: string;
    expected_learning: string;
    source: string;  // PROCEED: cites mvp_planning_output.experiment; else names the gap
    effort: Effort;
  };

  build_recommendations: {
    build: string[];   // validation-scoped; from mvp_planning_output.scope.in_scope
    avoid: string[];   // from mvp_planning_output.scope.out_of_scope
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
    would_change_decision_if: string; // the specific answer that would flip the decision
  }>;

  reasoning: string[];
}
```

### Scoring Framework

```
Dimension weights and primary sources:
  user_pain              0.30  ← define_output.problem_strength_score / 10
  market_potential       0.20  ← market_analysis_output.market_attractiveness_score / 10
  competitive_advantage  0.15  ← competitor_analysis_output.landscape_score / 10
  monetization           0.15  ← market_analysis_output.willingness_to_pay[beachhead].evidence_tier
  mvp_feasibility        0.10  ← mvp_planning_output.mvp_feasibility_score / 10
  execution_complexity   0.10  ← inverse of complexity (lower complexity = higher score)

Rubric bands (weighted_composite → provisional decision):
  0.0–4.9   →  DO NOT BUILD
  5.0–7.4   →  PROCEED WITH CAUTION
  7.5–10.0  →  PROCEED

Dimension caps (reduce score before composite):
  pain_profile.type === 'vitamin'                → user_pain capped at 4
  pain evidence is founder_self_report only      → user_pain capped at 5
  all demand signals are 'synthetic'             → market_potential capped at 5
  no behavioral demand evidence                  → market_potential capped at 6
  all differentiation.defensibility tactical     → competitive_advantage capped at 5
  beachhead WTP evidence_tier === 'analogous'    → monetization: 4–6 range max
  assumption_inversion_detected === true         → mvp_feasibility capped at 4

Knockout overrides (applied after composite; only ever downgrade):
  pain_profile.type === 'vitamin' + no behavioral WTP        → DO NOT BUILD
  beachhead WTP evidence_tier === 'none'                     → PROCEED WITH CAUTION max
  all differentiation tactical + incumbent risk critical     → PROCEED WITH CAUTION max
  assumption_inversion_detected === true                     → PROCEED WITH CAUTION max
  user_pain score < 4                                        → DO NOT BUILD
  market_size_carry_detected === true                        → PROCEED WITH CAUTION max
  trust_gate === 'pass_with_caveats'                         → PROCEED WITH CAUTION max
  trust_gate === 'incomplete'                                → PROCEED WITH CAUTION max
  trust_gate === 'fail'                                      → DO NOT BUILD
```

### Failure Modes

| Condition | Pipeline Effect |
|-----------|----------------|
| Any required input is null | `decision_status: 'incomplete_pipeline'`; `decision: 'DO NOT BUILD'`. Provisional. |
| `verification_output.verdict === 'reject'` | `decision_status: 'untrustworthy_analysis'`. Rationale must distinguish analysis failure from idea weakness. |
| `decision_rationale.strongest_counterargument` is empty | Contract violation. Every decision requires a stated counter-argument. |
| Any `dimension_scores[].ledger_refs` is empty | Untraceable score — contract violation. |
| `market_size_carry_detected === true` with no knockout entry | Contract violation. Knockout must be present and applied. |
| `build_recommendations.note` field is missing or altered | Contract violation. This literal string is required to prevent misreading as a roadmap. |
| Output is non-conforming JSON | Retry once. Second failure → **halt** with `halt_reason: 'contract_violation'`. Last stage; failure here means no terminal output exists. |

### Success Criteria

- `decision_status === 'complete'`
- `decision` is exactly one of the three valid values
- `trust_gate.gate_result` reflects `verification_output.verdict` accurately
- `dimension_scores[]` has exactly 6 entries; weights sum to 1.0
- `weighted_composite` equals the sum of all `weighted_contribution` values (within floating-point tolerance)
- All `dimension_scores[].ledger_refs` reference valid `evidence_ledger[].id` entries
- `decision_rationale.strongest_counterargument` is non-empty
- `decision_rationale.bear_case` is non-empty when `decision !== 'DO NOT BUILD'`
- `fastest_next_action.action` is non-empty
- `build_recommendations.note` contains the required literal string, unmodified

---

## Cross-Agent Field Traceability

Critical fields that flow from one agent to another and must remain consistent — not summarized, renamed, or reinterpreted between stages.

| Field | Origin Agent | Consumed by |
|-------|-------------|-------------|
| `define_output.problem_statement` | Define | Research (market boundary), Strategy (assumption source), Verification (drift detection) |
| `define_output.target_user.primary` | Define | Research (market/competitor scope), Strategy (beachhead user description) |
| `define_output.pain_profile.type` | Define | CEO Agent (vitamin knockout rule) |
| `define_output.assumptions[]` | Define | Strategy (`core_assumption.source_in_define_output`), Verification (assumption chain audit) |
| `define_output.status_quo.current_solutions[]` | Define | Competitor Analysis (seeds competitor inventory from Step 2) |
| `market_analysis_output.customer_segments[is_beachhead=true]` | Research | Strategy (beachhead user), CEO Agent (monetization scoring segment) |
| `market_analysis_output.willingness_to_pay[]` | Research | CEO Agent (monetization dimension scoring) |
| `market_analysis_output.market_attractiveness_score` | Research | CEO Agent (market_potential dimension) |
| `competitor_analysis_output.landscape_score` | Research | CEO Agent (competitive_advantage dimension) |
| `competitor_analysis_output.differentiation_opportunities[]` | Research | Verification (positioning audit), CEO Agent (competitive_advantage scoring) |
| `mvp_planning_output.assumption_inversion_detected` | Strategy | Critic (audit finding), CEO Agent (knockout rule) |
| `mvp_planning_output.core_assumption.source_in_define_output` | Strategy | Verification (traceability check) |
| `mvp_planning_output.scope` | Strategy | CEO Agent (`build_recommendations`) |
| `mvp_planning_output.mvp_feasibility_score` | Strategy | CEO Agent (mvp_feasibility dimension) |
| `verification_output.verdict` | Critic | Orchestrator (routing), CEO Agent (trust gate) |
| `verification_output.trustworthiness_score` | Critic | CEO Agent (`decision_confidence` ceiling) |
| `verification_output.required_revisions[]` | Critic | Orchestrator (passed to Strategy Agent on loop) |
| `verification_output.pipeline_recommendation.ceo_caveats` | Critic | CEO Agent (`trust_gate.caveats_carried`) |
