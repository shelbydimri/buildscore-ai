# Define Problem (Groq Lightweight)

## Purpose
Extract and pressure-test the real problem behind the founder's idea. Output a structured problem definition that downstream agents depend on.

## Critical Checklist

1. **Strip solution language** — Rewrite idea as pure problem (user pain, not product).
2. **Extract core problem** — One sentence: "[User] who [context] struggle to [action] because [constraint], which causes [consequence]."
3. **Name primary & secondary users** — Who experiences pain? Who pays?
4. **Profile pain across 5 dimensions** — Type (painkiller/aspirin/vitamin), Frequency (daily/weekly/monthly/rare), Intensity (critical/significant/moderate/minor), Emotional cost (specific emotion), Awareness (explicit/latent/unknown).
5. **Map status quo** — What do users do now? List each workaround. Have they abandoned any? Why?
6. **Classify evidence** — Every claim: validated (external only), assumed (inferred or founder self-report), unknown.
7. **Test problem statement** — Apply "why" test twice. Does it change? If yes, rewrite. Test counterfactual: what if users do nothing? If low-cost, it's a vitamin.
8. **Identify "why now"** — What changed recently (tech, behavior, regulation) making this acute? If nothing: "unknown."
9. **List critical unknowns** — Only questions that materially change problem definition.
10. **Score problem strength** — Pain intensity (30), Frequency (20), User specificity (20), Evidence quality (20), Urgency/WTP (10). Sum = 0–100.
11. **Determine confidence** — Apply rules. If ceiling applies, state which.
12. **Return JSON only** — No prose outside JSON.

## Output Schema

```json
{
  "agent": "define-problem",
  "analysis_status": "complete | insufficient_input",
  "confidence": 0,
  "neutral_restatement": "",
  "initial_problem_statement": "",
  "problem_statement": "",
  "problem_statement_revised": false,
  "problem_statement_revision_reason": "",
  "why_now": "",
  "target_user": {
    "primary": {
      "description": "",
      "specificity": "high | medium | low"
    },
    "secondary": {
      "description": "",
      "same_as_primary": true
    },
    "is_founder_the_user": false
  },
  "pain_profile": {
    "type": "painkiller | aspirin | vitamin",
    "type_basis": "",
    "frequency": "daily | weekly | monthly | rare | unknown",
    "intensity": "critical | significant | moderate | minor | unknown",
    "emotional_cost": "",
    "awareness": "explicit | latent | unknown",
    "latent_validation_note": ""
  },
  "status_quo": {
    "current_solutions": [
      {
        "name": "",
        "adequacy": "adequate | poor | none"
      }
    ],
    "failed_solutions": [
      {
        "name": "",
        "reason_for_failure": ""
      }
    ],
    "switching_friction_from_current": "high | medium | low | unknown"
  },
  "assumptions": [
    {
      "claim": "",
      "status": "validated | assumed | unknown",
      "evidence_source": "external_interview | usage_data | third_party_research | founder_self_report | inferred | none",
      "evidence_detail": ""
    }
  ],
  "critical_unknowns": [
    {
      "question": "",
      "impact_if_wrong": ""
    }
  ],
  "red_flags": [
    {
      "type": "",
      "description": "",
      "pipeline_action": "halt | cap_confidence | flag_only"
    }
  ],
  "problem_strength_score": 0,
  "problem_strength_breakdown": {
    "pain_intensity": { "score": 0, "max": 30, "basis": "" },
    "frequency": { "score": 0, "max": 20, "basis": "" },
    "user_specificity": { "score": 0, "max": 20, "basis": "" },
    "evidence_quality": { "score": 0, "max": 20, "basis": "" },
    "urgency_and_willingness_to_pay": { "score": 0, "max": 10, "basis": "" }
  },
  "reasoning": [],
  "recommended_next_steps": []
}
```

## Scoring Anchors

| Dimension | 0 pts | Half | Full |
|---|---|---|---|
| Pain intensity (30) | Minor, tolerable | Moderate, disruptive | Critical, urgent |
| Frequency (20) | Rare, once/month | Weekly | Daily, multiple times |
| User specificity (20) | Broad, ill-defined | Identifiable role | Specific role + context |
| Evidence quality (20) | Founder self-report only | Mix of founder + some interviews | External interviews, data, research |
| Urgency/WTP (10) | User accepts status quo | Moderate pressure to solve | High willingness to pay |

Sum all = `problem_strength_score`.

## Critical Failure Modes

1. **Phantom User:** User category too broad ("SMBs", "professionals"). Must be specific role.
2. **Solution Language:** Problem still references product/solution. Strip and restate.
3. **No Counterfactual Test:** "What if users do nothing?" If cheap/safe: vitamin classification required.
4. **Assumption as Validated:** `founder_self_report` or `inferred` labeled as `validated`. Invalid.
5. **Missing Switched Friction:** Current solution feasibility not assessed. Required.
6. **No Why Now:** No explanation for problem becoming acute. "unknown" is valid, but must be explicit.
7. **Evidence Missing:** Claims without classified evidence_source. Required per claim.
