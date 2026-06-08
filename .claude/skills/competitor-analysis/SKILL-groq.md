# Competitor Analysis (Groq Lightweight)

## Purpose
Map the competitive landscape around the defined problem and identify exploitable gaps where users currently struggle with existing solutions.

## Core Instructions

**Input validation — STOP if any:**
- `define_output.analysis_status` is `"insufficient_input"`: return `blocked_by_define`
- `define_output.confidence` below 40: cap confidence at 55
- `target_user.primary.specificity` is `"low"`: cap confidence at 50

**Process (execute in order):**

1. **Define Scope:** One sentence: "Products and behaviors [target_user] use to address [problem_statement]"
2. **Seed from Define:** Import `status_quo.current_solutions` and `status_quo.failed_solutions`. Classify each as direct/indirect/workaround.
3. **Identify Competitors:** Direct (solves same problem for same user), Indirect (partial/feature), Workarounds (behaviors users use)
4. **User Evidence Only:** Assess strengths/weaknesses using only: user_review_platform → user_forum → product_observation → analyst_report → inferred. Never use competitor_marketing for weaknesses.
5. **Extract User Complaints:** Must have source, frequency (pervasive/common/occasional/isolated), and specific user language. Not inferred.
6. **Switching Costs:** Assess data_migration, workflow_disruption, contract_lock, habit, integration_dependency. Classify overall as high/medium/low.
7. **Differentiation Opportunities:** Must trace to specific user complaints (not invented). Classify defensibility as structural/tactical/unknown with basis.
8. **Incumbent Response:** Assess capability (can they copy?) and incentive (do they care?). Score overall_risk as critical/moderate/low.
9. **Score Landscape:** Sum five dimensions to `landscape_score` (0–100).
10. **Classify Claims:** Every claim → competitive_claims with classification: sourced / observed / inferred.

**Critical rules:**
- **REQUIRED: competitors[] MUST include at least one entry with type: 'workaround'** (e.g., spreadsheets, manual processes, existing habits, hiring freelancers, doing nothing). This is non-negotiable. Contract violation if absent.
- **REQUIRED: differentiation_opportunities[].defensibility_basis MUST be non-empty string (why incumbent cannot copy without breaking business)**
- **REQUIRED: differentiation_opportunities[].source_complaints[] MUST be non-empty array (traceable to specific user_complaints entries)**
- No competitor means incomplete analysis. Document workarounds at minimum.
- Weakness without user evidence = fabricated. Flag and remove.
- Generic opportunities ("better UX") invalid without specific user complaint source.
- Structural gaps must name why incumbent cannot fix without breaking business.
- All differentiation opportunities must reference specific user_complaints entries.

## Output Schema

```json
{
  "agent": "competitor-analysis",
  "analysis_status": "complete | blocked_by_define | insufficient_data",
  "confidence": 0,
  "upstream_dependency_risk": "",
  "competitive_scope": "",
  "competitors": [
    {
      "name": "",
      "type": "direct | indirect | workaround",
      "description": "",
      "target_user_overlap": "high | medium | low | unknown",
      "problem_coverage": "full | partial | incidental",
      "market_position": "dominant | established | emerging | niche | unknown",
      "traction_signal": "",
      "strengths": [
        {
          "claim": "",
          "evidence_source": "user_review_platform | user_forum | product_observation | analyst_report | competitor_marketing | inferred",
          "evidence_detail": ""
        }
      ],
      "weaknesses": [
        {
          "claim": "",
          "evidence_source": "user_review_platform | user_forum | product_observation | analyst_report | inferred",
          "evidence_detail": "",
          "weakness_type": "structural | tactical | unknown"
        }
      ],
      "user_complaints": [
        {
          "complaint": "",
          "source_type": "user_review_platform | user_forum | support_thread | inferred",
          "source_detail": "",
          "frequency": "pervasive | common | occasional | isolated | unknown"
        }
      ],
      "switching_cost": {
        "overall": "high | medium | low | unknown",
        "primary_driver": "data_migration | workflow_disruption | contract_lock | habit | integration_dependency | unknown",
        "basis": ""
      },
      "incumbent_response": {
        "capability": "high | medium | low | unknown",
        "incentive": "high | medium | low | unknown",
        "overall_risk": "critical | moderate | low | unknown",
        "basis": ""
      }
    }
  ],
  "category_wide_gaps": [
    {
      "gap": "",
      "appears_in": [],
      "implication": ""
    }
  ],
  "differentiation_opportunities": [
    {
      "opportunity": "",
      "source_complaints": [],
      "exploits_competitor": "",
      "defensibility": "structural | tactical | unknown",
      "defensibility_basis": "",
      "incumbent_can_copy": true,
      "incumbent_copy_timeline": "immediate | within_6_months | within_2_years | unlikely | unknown"
    }
  ],
  "landscape_score": 0,
  "landscape_score_breakdown": {
    "incumbent_vulnerability": { "score": 0, "max": 25, "basis": "" },
    "switching_cost_manageability": { "score": 0, "max": 20, "basis": "" },
    "differentiation_clarity": { "score": 0, "max": 20, "basis": "" },
    "incumbent_response_risk": { "score": 0, "max": 20, "basis": "" },
    "workaround_quality": { "score": 0, "max": 15, "basis": "" }
  },
  "competitive_claims": [
    {
      "claim": "",
      "about_competitor": "",
      "classification": "sourced | observed | inferred",
      "source_detail": ""
    }
  ],
  "assumptions": [
    {
      "claim": "",
      "status": "validated | assumed | unknown",
      "evidence_source": "user_review_platform | user_forum | analyst_report | product_observation | founder_assertion | inferred | none",
      "evidence_detail": ""
    }
  ],
  "critical_unknowns": [
    {
      "question": "",
      "impact_if_unresolved": "",
      "blocks_downstream": false
    }
  ],
  "red_flags": [
    {
      "type": "",
      "description": "",
      "severity": "critical | major | minor",
      "pipeline_action": "halt | cap_confidence | flag_only"
    }
  ],
  "reasoning": [],
  "recommended_research": [
    {
      "action": "",
      "expected_signal": "",
      "effort": "low | medium | high",
      "priority": 0
    }
  ]
}
```

## Scoring Anchors

| Dimension | 0 pts | Half | Full |
|---|---|---|---|
| Incumbent vulnerability (25) | No complaints; workarounds adequate | Complaints present, tactical only | Pervasive structural complaints sourced |
| Switching cost manageability (20) | High across all solutions | Moderate friction | Low cost, easy switching |
| Differentiation clarity (20) | No clear opportunity | One tactical opportunity | Multiple structural opportunities |
| Incumbent response risk (20) | High capability + incentive | Could copy, low incentive | Cannot copy, or beneath notice |
| Workaround quality (15) | Users satisfied with workaround | Functional, manual effort | Poor, significant user cost |

Sum all = `landscape_score`.

## Critical Failure Modes

1. **No Workaround Entry:** competitors[] does not include at least one entry with type='workaround' = **CONTRACT VIOLATION**. `halt` Must include: spreadsheets, manual processes, hiring freelancers, existing habits, or "do nothing" behaviors.
2. **No Competitors:** Empty competitors[] = incomplete. Must document at least workarounds. `halt`
3. **Weakness Without Evidence:** `evidence_source: "inferred"` or `"competitor_marketing"` for weaknesses = fabricated. Remove. `cap_confidence` at 55
4. **Generic Opportunities:** "Better UX" without specific complaint source = invalid. Require source_complaints reference.
5. **Tactical-as-Structural:** Classified structural without explaining why incumbent cannot fix. `flag_only`
6. **Untraced Opportunities:** `source_complaints` empty = not evidence-grounded. Invalid.
7. **Incumbent Response Unknown:** Direct competitors without capability/incentive assessment = incomplete. `flag_only`
8. **Complaints Inferred Only:** All `user_complaints[].source_type: "inferred"` = fabricated. `cap_confidence` at 45
