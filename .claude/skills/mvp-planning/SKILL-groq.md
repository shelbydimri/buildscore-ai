# MVP Planning (Groq Lightweight)

## Purpose
Design the smallest, cheapest validation experiment that tests the core assumption before building a product.

## Core Instructions

**Input validation — STOP if any:**
- `define_output.analysis_status` is `"insufficient_input"`: return `blocked_by_define`
- `define_output.confidence` below 50: cap confidence at 60
- `pain_profile.type` is `"vitamin"`: flag—vitamins need stronger validation
- `market_analysis_output` absent: cap confidence at 65

**Process (execute in order):**

1. **Extract Assumption Stack:** Map each assumption from Define output to layer: Layer 1 (Value) → Layer 2 (Demand) → Layer 3 (Willingness to Pay) → Layer 4 (Retention) → Layer 5 (Solution). Identify lowest unvalidated layer as `core_assumption`.

2. **Check Assumption Inversion:** If Layers 1–3 are unvalidated and MVP is a full software product, flag `assumption_inversion_detected: true`. MVP must target lower layers first.

3. **Select Experiment Type (lowest cost first):** problem_interview → demand_test → willingness_to_pay_test → concierge_mvp → wizard_of_oz → prototype_test → functional_mvp. Record why cheaper options were ruled out.

4. **Define Beachhead User:** One sentence. "This experiment is for [specific role] who [specific context] and currently [specific workaround]."

5. **Define Minimum Scope:** Only include elements that test the core assumption. For each in-scope element: state what assumption layer it tests, what user behavior signals success.

6. **Explicitly List Out-of-Scope:** Prevent scope creep. Auth, billing, admin dashboards, APIs, mobile, multi-tenant, advanced onboarding are default out-of-scope unless they test the core assumption.

7. **Define Pre-Committed Success Criteria:** Must be specific (number, behavior, retention pattern), time-bound, behavioral (not attitudinal), and falsifiable. Layer 1: user describes problem as top-3 frustration. Layer 3: user completes financial transaction. Layer 4: [N]% return within [X] days.

8. **Define Pivot Triggers:** Pre-commit to specific, measurable conditions that cause a direction change (abandon, reframe, change segment, change solution, change channel).

9. **Identify Validation Risks:** False positive risks (politeness bias, friends distortion, novelty effect) and false negative risks (wrong channel, incomplete experiment, wrong beachhead). Describe mitigations.

10. **Score MVP Feasibility:** Sum five dimensions (assumption_clarity, experiment_design, success_criteria_quality, time_to_learning, validation_risk_management). Must = 0–100.

**Critical rules:**
- Core assumption must be single, specific, falsifiable, from Define output's lowest unvalidated layer.
- Functional MVP only after Layers 1–3 are validated.
- Success criteria must be behavioral and pre-committed.
- Every in-scope element must trace to the core assumption.
- Time-to-learning should be ≤45 days.

## Output Schema

```json
{
  "agent": "mvp-planning",
  "analysis_status": "complete | blocked_by_define | insufficient_upstream_data",
  "confidence": 0,
  "upstream_dependency_risk": "",
  "assumption_inversion_detected": false,
  "core_assumption": {
    "statement": "",
    "layer": "value | demand | willingness_to_pay | retention | solution",
    "source_in_define_output": "",
    "why_highest_risk": ""
  },
  "assumption_stack": [
    {
      "assumption": "",
      "layer": "value | demand | willingness_to_pay | retention | solution",
      "validation_status": "validated | unvalidated | unknown",
      "evidence_basis": "",
      "is_core_target": false
    }
  ],
  "experiment": {
    "type": "problem_interview | demand_test | willingness_to_pay_test | concierge_mvp | wizard_of_oz | prototype_test | functional_mvp",
    "type_rationale": "",
    "lower_cost_options_ruled_out": [
      {
        "type": "problem_interview | demand_test | willingness_to_pay_test | concierge_mvp | wizard_of_oz | prototype_test | functional_mvp",
        "reason_excluded": ""
      }
    ],
    "beachhead_user": "",
    "time_bound_days": 0,
    "resource_bound": ""
  },
  "scope": {
    "in_scope": [
      {
        "element": "",
        "assumption_layer_tested": "value | demand | willingness_to_pay | retention | solution",
        "user_behavior_required": "",
        "justification": ""
      }
    ],
    "out_of_scope": [
      {
        "element": "",
        "reason": ""
      }
    ]
  },
  "success_criteria": [
    {
      "criterion": "",
      "measurement_method": "",
      "timeframe_days": 0,
      "minimum_sample_size": 0,
      "layer_validated": "value | demand | willingness_to_pay | retention | solution",
      "is_behavioral": true,
      "is_pre_committed": true
    }
  ],
  "pivot_triggers": [
    {
      "condition": "",
      "timeframe_days": 0,
      "implied_direction": "abandon | reframe_problem | change_segment | change_business_model | change_solution_approach | change_channel"
    }
  ],
  "validation_risks": [
    {
      "risk_type": "false_positive | false_negative",
      "description": "",
      "mitigation": ""
    }
  ],
  "mvp_feasibility_score": 0,
  "mvp_feasibility_breakdown": {
    "assumption_clarity": { "score": 0, "max": 25, "basis": "" },
    "experiment_design": { "score": 0, "max": 25, "basis": "" },
    "success_criteria_quality": { "score": 0, "max": 20, "basis": "" },
    "time_to_learning": { "score": 0, "max": 15, "basis": "" },
    "validation_risk_management": { "score": 0, "max": 15, "basis": "" }
  },
  "assumptions": [],
  "critical_unknowns": [],
  "red_flags": [],
  "reasoning": [],
  "recommended_next_actions": []
}
```

## Scoring Anchors

| Dimension | 0 pts | Half | Full |
|---|---|---|---|
| Assumption clarity (25) | Compound/vague, multiple assumptions conflated | Identified but includes subsidiary assumptions | Single, specific, falsifiable assumption from Define; lowest unvalidated layer |
| Experiment design (25) | Full software before Layers 1–3 validated | Appropriate type but includes scope creep | Lowest-cost experiment type; all elements trace to assumption |
| Success criteria quality (20) | None, or attitudinal | Behavioral but not pre-committed, timeframe/sample unspecified | Specific, behavioral, time-bound, pre-committed, falsifiable |
| Time-to-learning (15) | >90 days to signal, no checkpoints | 45–90 days, one checkpoint | <45 days, multiple checkpoints |
| Validation risk management (15) | No risks identified | 1–2 risks with partial mitigations | False positive and false negative risks both identified with mitigations |

Sum all = `mvp_feasibility_score`.

## Critical Failure Modes

1. **Assumption Inversion:** Layers 1–3 unvalidated, MVP is functional product. `cap_feasibility` at 50.
2. **Scope Creep:** Elements don't trace to core assumption. Flag and remove.
3. **Attitudinal Success Criteria:** "Users liked it" invalid. Require behavioral signals.
4. **Wrong Beachhead:** Experiment targets wrong segment. Verify against market analysis.
5. **No Pivot Triggers:** Confirmation bias without pre-committed triggers. Require all pivot conditions.
6. **Long Timeline:** >60 days to signal = not validated quickly. Favor faster learning.
