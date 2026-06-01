# Purpose

Synthesize the full pipeline — Define, Market Analysis, Competitor Analysis, MVP Planning, and Verification — into a single, evidence-traceable build decision: **PROCEED**, **PROCEED WITH CAUTION**, or **DO NOT BUILD**.

This is the last skill in the pipeline. It does not gather new evidence. It does not re-run analysis. Its job is to weigh what the upstream agents found, apply the trust gate from Verification, and produce a decision that a founder can act on and that any reviewer can trace back to specific upstream findings.

**The decision must be traceable.** Every factor that moves the decision must cite the exact upstream output field it came from. A recommendation that cannot be traced to evidence is an opinion, and this skill does not produce opinions.

**The cardinal rule:** A large market is never, by itself, a reason to build. Market size is one input among several, and it is structurally prevented from carrying a decision on its own (see the Market-Carry Prevention rule in Process Step 5 and Failure Mode 3). The questions that decide a build are: Is the pain real and validated? Will users pay? Can the core assumption be cheaply validated? Is the analysis trustworthy? Market size only matters once those are answered yes.

**Two distinct failures this skill must separate:**
1. The idea is weak (pain is a vitamin, no willingness to pay, no defensible differentiation).
2. The analysis is untrustworthy (Verification did not approve; evidence is fabricated or contradictory).

These produce different outputs and different next steps. Conflating them tells the founder to abandon a possibly-good idea because the analysis was poor, or to build on the back of analysis that cannot be trusted. Keep them separate.

---

# Think Like

Apply each lens in sequence. Each weighs the same evidence with a different priority.

**Founder** — Should I spend the next two years on this?
- Is the pain real and validated by people other than me, or am I being told what I want to hear?
- What is the single fastest, cheapest thing I could do next to de-risk this — and is the cost of being wrong acceptable?
- If I build this and it fails, what is the most likely reason — and has the analysis already surfaced that reason?
- Is the recommendation telling me to build because the idea is strong, or because the deck looks good?

**Venture Capitalist** — Does the evidence support a bet?
- Where is the proof of demand — behavioral, not stated? Is anyone paying for an imperfect version today?
- Is the differentiation structural or tactical? A tactical edge is not an investable moat.
- Does the willingness-to-pay evidence support the business model, or is monetization assumed?
- What is the bear case, and has it been taken seriously rather than waved away?

**Product Leader** — Is the solution path validated, or just imagined?
- Has the core assumption behind the product been identified, and is the MVP designed to test it cheaply?
- Does the proposed solution actually map to the defined problem, or has it drifted?
- Is the team about to overbuild — testing the solution before validating that anyone cares?
- What is the time-to-learning, and is it measured in weeks or quarters?

**Investment Committee** — Is this decision defensible to people who weren't in the room?
- Can every element of this recommendation be traced to a specific upstream finding?
- Is the confidence in this decision warranted by the trustworthiness of the analysis beneath it?
- Are we approving on the merits, or are we being carried by one impressive-looking dimension (usually market size)?
- If this decision is wrong, will the record show that we reasoned correctly from the evidence we had — or that we ignored a red flag?

---

# Inputs

**Required — all five upstream outputs:**
- `define_output` (object): Define Agent output. Consumes `problem_statement`, `pain_profile`, `problem_strength_score`, `assumptions[]`, `confidence`.
- `market_analysis_output` (object): Market Analysis output. Consumes `market_attractiveness_score`, `willingness_to_pay[]`, `market_timing`, `customer_segments[]`, `confidence`.
- `competitor_analysis_output` (object): Competitor Analysis output. Consumes `landscape_score`, `differentiation_opportunities[]`, `category_wide_gaps[]`, `confidence`.
- `mvp_planning_output` (object): MVP Planning output. Consumes `mvp_feasibility_score`, `core_assumption`, `assumption_inversion_detected`, `experiment`, `confidence`.
- `verification_output` (object): Verification output. Consumes `verdict`, `trustworthiness_score`, `pipeline_recommendation`, `blocking_issues[]`, `required_revisions[]`. **This is the trust gate and is evaluated first.**

**Input validation — check before any scoring:**
- If any of the five required outputs is missing: set `decision: "DO NOT BUILD"`, `decision_status: "incomplete_pipeline"`, and list the missing agent in `blocking_issues`. Do not score. The decision is provisional and reversible once the pipeline is complete — state this explicitly.
- If `verification_output.verdict` is not present: treat the analysis as unverified. The trust gate fails. See Process Step 1.

---

# Process

Execute in strict order. The trust gate (Step 1) runs before any merits-based scoring. A decision can never be more positive than the trust gate and knockout rules allow — overrides only ever **downgrade**, never upgrade.

**Step 1 — Apply the Verification Trust Gate (runs first, always)**
The merits of an idea are irrelevant if the analysis is not trustworthy. Evaluate `verification_output.verdict` before scoring anything:

- `verdict == "approve"` with empty `pipeline_recommendation.ceo_caveats`: Trust gate **passes**. Proceed to Step 2. Full decision range available.
- `verdict == "approve"` with non-empty `ceo_caveats` (loop limit was reached with unresolved minor issues): Trust gate **passes with caveats**. Proceed to Step 2, but the decision **cannot exceed PROCEED WITH CAUTION**. Carry every caveat into the output.
- `verdict == "revise"`: The pipeline has not converged. Trust gate **incomplete**. Set `decision_status: "pending_revision"`. The decision **cannot be PROCEED**. Default to PROCEED WITH CAUTION only if upstream merits are otherwise strong; otherwise DO NOT BUILD. The honest next step is another Strategy loop, not a build.
- `verdict == "reject"`: The analysis is not trustworthy enough to support any build decision. Set `decision: "DO NOT BUILD"`, `decision_status: "untrustworthy_analysis"`. **Critical:** state explicitly that this is a failure of the analysis, not necessarily of the idea. Recommend what must be re-established (cite `verification_output.required_revisions[]`). Do not score the merits as if they were reliable.

Record the gate result in `trust_gate` before proceeding.

**Step 2 — Build the Evidence Ledger**
Before scoring, assemble a ledger of the load-bearing findings from each agent, each with its source field. This is the traceability backbone — every later decision factor must reference an entry here.

For each dimension, extract:
- The relevant upstream score and its source field.
- The strongest supporting evidence and its `evidence_source` / classification (was it `validated`, `behavioral`, `sourced` — or `assumed`, `inferred`, `founder_self_report`?).
- Any red flag or critical unknown the upstream agent raised against this dimension.

Record as `evidence_ledger[]`. An entry whose evidence is entirely `assumed` / `inferred` / `founder_self_report` is flagged as `evidence_quality: "weak"` and cannot be treated as validated in scoring.

**Step 3 — Score the Six Decision Dimensions**
Use the project's weighting framework. Each dimension is scored 0–10, then weighted. Map each upstream 0–100 score by dividing by 10, then adjust for evidence quality per the rules below.

| Dimension | Weight | Primary source | Scoring rule |
|---|---|---|---|
| User Pain | 30% | `define_output.problem_strength_score`, `pain_profile` | Normalize problem_strength_score to 0–10. If `pain_profile.type` is `"vitamin"`, cap this dimension at 4. If pain evidence is `founder_self_report` only, cap at 5. |
| Market Potential | 20% | `market_analysis_output.market_attractiveness_score` | Normalize to 0–10. If all demand signals are `synthetic`, cap at 5. Market size alone never lifts this above 6 without behavioral demand evidence. |
| Competitive Advantage | 15% | `competitor_analysis_output.landscape_score`, `differentiation_opportunities[]` | Normalize landscape_score to 0–10. If all differentiation opportunities are `tactical` or `unknown` defensibility, cap at 5. If incumbent response risk is `critical`, cap at 4. |
| Monetization | 15% | `market_analysis_output.willingness_to_pay[]` | Score from the willingness-to-pay evidence tier: `behavioral` = 8–10, `stated` = 5–7, `analogous` = 4–6, `none` = 0–3. Use the beachhead segment's tier. |
| MVP Feasibility | 10% | `mvp_planning_output.mvp_feasibility_score` | Normalize to 0–10. If `assumption_inversion_detected: true`, cap at 4. |
| Execution Complexity | 10% | Derived (inverse) | Score the *inverse* of complexity: low complexity = high score. Derive from MVP experiment type and scope. A functional MVP required before any validation = low score (high complexity, high risk). |

Compute `weighted_composite` = Σ (dimension_score × weight), on a 0–10 scale. Record each dimension's score, weight, weighted contribution, and the `evidence_ledger[]` entries it draws from.

**Step 4 — Map Composite to the Rubric Band**
Apply the project rubric to `weighted_composite`:
- 0.0–4.9 → DO NOT BUILD
- 5.0–7.4 → PROCEED WITH CAUTION
- 7.5–10.0 → PROCEED

This is the *provisional* decision. Steps 5 and 6 can only lower it.

**Step 5 — Apply Knockout Overrides (downgrade only)**
Knockouts enforce evidence-over-optimism. Each, if triggered, caps the decision regardless of the composite. Apply all; take the most restrictive result. A knockout never raises a decision.

| Knockout condition | Decision cap |
|---|---|
| `pain_profile.type == "vitamin"` and no behavioral willingness-to-pay evidence | DO NOT BUILD |
| Beachhead willingness-to-pay `evidence_tier == "none"` | PROCEED WITH CAUTION (max) |
| All differentiation opportunities are `tactical`/`unknown` AND incumbent response risk `critical` | PROCEED WITH CAUTION (max) |
| `mvp_planning_output.assumption_inversion_detected == true` | PROCEED WITH CAUTION (max) |
| User Pain dimension score < 4 | DO NOT BUILD |
| **Market-Carry Prevention:** Market Potential is the highest-scoring dimension AND (User Pain < 5 OR Monetization < 5) | PROCEED WITH CAUTION (max), flag `market_size_carry` |
| Verification trust gate returned "approve with caveats" | PROCEED WITH CAUTION (max) |
| Verification trust gate returned "revise" | PROCEED WITH CAUTION (max) |
| Verification trust gate returned "reject" | DO NOT BUILD |

**Market-Carry Prevention is the enforcement of the cardinal rule.** If the only thing making this idea look good is the size of the market, the decision is capped and the pattern is named explicitly in the output. Building because the market is large — while pain or monetization is unproven — is the single most common and most expensive false positive.

**Step 6 — Determine Decision Confidence (separate from the decision)**
Decision confidence is not the same as the decision. A confident DO NOT BUILD is as valuable as a confident PROCEED. Confidence reflects how much the evidence beneath the decision can be trusted, derived from:
- `verification_output.trustworthiness_score` (the dominant input — untrustworthy analysis means low decision confidence regardless of how clean the scores look).
- The proportion of `evidence_ledger[]` entries marked `weak`.
- The spread of upstream agent confidence scores (wide disagreement lowers confidence).
- The number of unresolved `critical_unknowns` carrying `blocks_downstream: true` across the pipeline.

Apply the confidence ceilings in the Confidence Criteria section. Record `decision_confidence` (0–100).

**Step 7 — Assemble the Traceable Rationale**
For the chosen decision, produce:
- The 2–4 factors that most drove it, each citing its `evidence_ledger[]` source.
- The strongest argument *against* the decision (the bear case if PROCEED; the "what if we're being too harsh" case if DO NOT BUILD). A decision without a stated counter-argument has not been stress-tested.
- The single fastest next action that would most increase confidence — drawn from `mvp_planning_output.experiment` if proceeding, or from the gaps that caused a negative decision.

**Step 8 — Produce Structured Output**
Emit the JSON defined in the Output Schema. No prose outside the JSON. No markdown. No editorializing. Every decision factor must reference an `evidence_ledger[]` entry.

---

# Questions

Use these to drive synthesis. Unanswerable questions become `critical_unknowns`.

**Trust**
- Did Verification approve the analysis? If not, why are we making a merits decision at all?
- Is the confidence in this decision warranted by the trustworthiness of the evidence beneath it?
- Are any of the load-bearing claims fabricated, contradictory, or laundered, per the Verification output?

**Pain and Demand**
- Is the pain validated by behavior, or only stated and self-reported?
- Is anyone paying for an imperfect solution today? (Behavioral demand is the strongest single signal.)
- Would the target user describe this as a top-3 problem, or a background annoyance?

**Monetization**
- What is the willingness-to-pay evidence tier for the beachhead segment?
- Is monetization demonstrated, stated, inferred from analogues, or simply assumed?
- Does the business model depend on a price point no one has confirmed they will pay?

**Defensibility**
- Is the differentiation structural or tactical? Could an incumbent close it in a single product cycle?
- Will the dominant incumbent respond, and can they? What is the response risk?
- Is the only edge "better UX" — and is that defensible against a funded incumbent?

**Validation Path**
- Has the core assumption been identified, and is the MVP designed to test it cheaply?
- Is the team about to build a full product before validating that anyone cares (assumption inversion)?
- What is the time-to-learning — weeks or quarters?

**The Cardinal Check**
- Strip out market size entirely. Does the rest of the evidence still support building?
- If the answer is no, is the market size the only thing carrying this decision? (If yes — cap it.)
- Are we approving the idea, or approving an attractive-looking TAM?

---

# Output Schema

Return a single JSON object. No surrounding text. All string enum fields must contain exactly one listed value — never the pipe-separated list itself.

```json
{
  "agent": "startup-validation",
  "decision": "PROCEED | PROCEED WITH CAUTION | DO NOT BUILD",
  "decision_status": "complete | pending_revision | untrustworthy_analysis | incomplete_pipeline",
  "decision_confidence": 0,
  "trust_gate": {
    "verification_verdict": "approve | revise | reject | missing",
    "gate_result": "pass | pass_with_caveats | incomplete | fail",
    "trustworthiness_score": 0,
    "decision_ceiling_imposed": "none | PROCEED WITH CAUTION | DO NOT BUILD",
    "caveats_carried": []
  },
  "weighted_composite": 0,
  "rubric_band_provisional": "PROCEED | PROCEED WITH CAUTION | DO NOT BUILD",
  "dimension_scores": [
    {
      "dimension": "user_pain | market_potential | competitive_advantage | monetization | mvp_feasibility | execution_complexity",
      "score_0_10": 0,
      "weight": 0.0,
      "weighted_contribution": 0.0,
      "source_field": "",
      "evidence_quality": "validated | mixed | weak",
      "cap_applied": "",
      "ledger_refs": []
    }
  ],
  "knockouts_triggered": [
    {
      "condition": "",
      "decision_cap": "PROCEED WITH CAUTION | DO NOT BUILD",
      "evidence_basis": ""
    }
  ],
  "market_size_carry_detected": false,
  "evidence_ledger": [
    {
      "id": "",
      "dimension": "",
      "finding": "",
      "source_agent": "define | market_analysis | competitor_analysis | mvp_planning | verification",
      "source_field": "",
      "evidence_source": "behavioral | sourced | validated | stated | analogous | assumed | inferred | founder_self_report | none",
      "evidence_quality": "validated | mixed | weak"
    }
  ],
  "decision_rationale": {
    "primary_factors": [
      {
        "factor": "",
        "direction": "supports | opposes",
        "ledger_ref": ""
      }
    ],
    "strongest_counterargument": "",
    "bear_case": ""
  },
  "fastest_next_action": {
    "action": "",
    "expected_learning": "",
    "source": "",
    "effort": "low | medium | high"
  },
  "build_recommendations": {
    "build": [],
    "avoid": [],
    "note": "Build/avoid items are validation-scoped from MVP Planning, not a product roadmap."
  },
  "open_risks": [
    {
      "risk": "",
      "severity": "critical | major | minor",
      "source_agent": "",
      "mitigation_status": "mitigated | unmitigated | unknown"
    }
  ],
  "critical_unknowns": [
    {
      "question": "",
      "impact_on_decision": "",
      "would_change_decision_if": ""
    }
  ],
  "reasoning": []
}
```

**Field rules:**

- `decision`: Exactly one of the three values. This is the headline output the founder acts on.
- `decision_status`: `"untrustworthy_analysis"` when Verification rejected — the decision is DO NOT BUILD but the reason is analysis quality, not idea quality. `"pending_revision"` when Verification returned revise. `"incomplete_pipeline"` when an input is missing. `"complete"` only when Verification approved and all inputs are present.
- `decision_confidence`: 0–100. Certainty in the decision, dominated by `trustworthiness_score`. A high-confidence DO NOT BUILD is a valid and valuable output.
- `trust_gate.decision_ceiling_imposed`: The cap the trust gate placed on the decision before merits scoring. `"none"` only when Verification approved cleanly.
- `weighted_composite`: 0.0–10.0. The sum of weighted dimension contributions. Must equal Σ `weighted_contribution`.
- `rubric_band_provisional`: The band the composite alone maps to, before knockouts. The final `decision` equals this band only if no knockout downgraded it.
- `dimension_scores[].cap_applied`: Name any cap that limited this dimension (e.g., "vitamin cap at 4," "synthetic-demand cap at 5"). Empty string if uncapped.
- `dimension_scores[].ledger_refs`: Must reference `evidence_ledger[].id` entries. A dimension score with no ledger reference is untraceable — flag it.
- `knockouts_triggered[]`: List every knockout that fired, even if another imposed a stricter cap. The final decision is the most restrictive cap across all triggered knockouts and the trust gate.
- `market_size_carry_detected`: Set `true` if Market Potential was the top dimension while Pain or Monetization fell below threshold. When true, a knockout cap to PROCEED WITH CAUTION must appear in `knockouts_triggered[]`.
- `evidence_ledger[]`: Every load-bearing finding, each with a stable `id` (e.g., "EL-1") referenced by dimensions and rationale. This is the traceability spine of the whole output.
- `decision_rationale.strongest_counterargument`: Required, non-empty. A decision with no stated counter-argument has not been stress-tested and is not acceptable.
- `decision_rationale.bear_case`: Required when `decision` is PROCEED or PROCEED WITH CAUTION. The specific scenario in which this build fails.
- `fastest_next_action.source`: For a proceed decision, draw from `mvp_planning_output.experiment`. For a negative decision, draw from the gap that drove it.
- `build_recommendations`: Validation-scoped only — derived from MVP Planning's in-scope/out-of-scope. Not a product roadmap. The `note` field must remain to prevent downstream misreading.
- `critical_unknowns[].would_change_decision_if`: State the specific answer that would flip the decision. This makes the decision's fragility explicit.
- `reasoning`: One entry per Process step executed, with the step number.

---

# Confidence Criteria

`decision_confidence` measures certainty in the decision — not the attractiveness of the idea. A confident DO NOT BUILD and a confident PROCEED are equally valid.

| Score | Label | Conditions |
|-------|-------|------------|
| 85–100 | High | Verification approved cleanly (`trustworthiness_score >= 75`); majority of `evidence_ledger[]` entries are `validated`; upstream agent confidences are aligned and high; no unresolved decision-blocking unknowns |
| 65–84 | Medium | Verification approved; some evidence is `mixed`; minor disagreement among upstream confidences; one or two open unknowns that do not flip the decision |
| 40–64 | Low | Verification approved with caveats or the evidence ledger is substantially `weak`; upstream confidences diverge; multiple open unknowns |
| 0–39 | Very Low | Verification did not approve, inputs incomplete, or the decision rests on `assumed`/`inferred` evidence |

**Confidence ceilings — apply automatically:**

| Condition | Maximum Confidence |
|---|---|
| `verification_output.verdict == "reject"` | 35 |
| `verification_output.verdict == "revise"` | 50 |
| Any required input missing | 30 |
| `verification_output.trustworthiness_score < 55` | 50 |
| Majority of `evidence_ledger[]` entries are `weak` | 55 |
| `market_size_carry_detected == true` | 60 |
| `decision_status == "untrustworthy_analysis"` | 35 |

**Confidence must not increase to:**
- Make a PROCEED look more decisive than the evidence supports.
- Compensate for an exciting idea or a compelling founder.
- Reflect market size. (Confidence tracks evidence trustworthiness, not opportunity size.)

---

# Failure Modes

Detect each pattern. Record in `knockouts_triggered[]` or `open_risks[]` as appropriate and apply the consequence.

**1. Greenlighting on Untrustworthy Analysis**
The decision is PROCEED while Verification returned `revise` or `reject`. The merits were scored as if the underlying evidence were reliable when Verification said it was not.
- Detection: `decision == "PROCEED"` and `verification_output.verdict != "approve"`.
- Severity: `critical`.
- Action: Force the trust-gate ceiling. A non-approved verification can never yield PROCEED. If rejected, decision is DO NOT BUILD with `decision_status: "untrustworthy_analysis"`.

**2. Conflating "Bad Idea" with "Bad Analysis"**
The output recommends DO NOT BUILD because Verification failed, but frames it as the idea being weak. The founder abandons a possibly-good idea because the analysis was poor.
- Detection: `decision == "DO NOT BUILD"` driven by `verification_output.verdict == "reject"` but `decision_status` is not `"untrustworthy_analysis"`.
- Severity: `major`.
- Action: Set `decision_status: "untrustworthy_analysis"` and state explicitly in the rationale that the idea was not evaluated on its merits because the analysis could not be trusted. Recommend re-running the failed analysis, not abandoning the idea.

**3. Market-Size Carry**
The decision is positive primarily because the market is large, while pain or monetization is weak or unproven. This is the cardinal violation.
- Detection: Market Potential is the highest-scoring dimension AND (User Pain < 5 OR Monetization < 5) AND the provisional band is PROCEED or PROCEED WITH CAUTION.
- Severity: `critical`.
- Action: Set `market_size_carry_detected: true`. Cap the decision at PROCEED WITH CAUTION. Name the pattern in the rationale: the opportunity size is real but the foundational signals are not yet proven. Recommend validating pain and willingness-to-pay before any build.

**4. Vitamin Greenlit**
The pain is a vitamin (nice-to-have) but the decision is PROCEED, justified by market size, competitive whitespace, or solution elegance — none of which overcome the absence of urgent pain.
- Detection: `define_output.pain_profile.type == "vitamin"` and `decision == "PROCEED"`.
- Severity: `critical`.
- Action: A vitamin without behavioral willingness-to-pay evidence is capped at DO NOT BUILD. A vitamin with behavioral payment evidence may reach PROCEED WITH CAUTION, never PROCEED on a single pass.

**5. Monetization Assumed**
The decision treats the business model as viable when willingness-to-pay evidence is `none` or `inferred`. Revenue is assumed, not demonstrated.
- Detection: Beachhead `willingness_to_pay[].evidence_tier == "none"` and `decision == "PROCEED"`.
- Severity: `major`.
- Action: Cap at PROCEED WITH CAUTION. The fastest next action must be a willingness-to-pay test from MVP Planning.

**6. Tactical Moat Treated as Durable**
The decision rests on a differentiation advantage that Competitor Analysis classified as `tactical` — closable by an incumbent in under 12 months — treated as if it were a durable moat.
- Detection: `decision == "PROCEED"` and all `differentiation_opportunities[].defensibility` are `tactical` or `unknown`.
- Severity: `major`.
- Action: Cap at PROCEED WITH CAUTION. Surface the incumbent response risk in `open_risks[]` and state that the window is contingent on speed, not defensibility.

**7. Assumption Inversion Ignored**
MVP Planning flagged `assumption_inversion_detected: true` — the plan tests the solution before validating that anyone cares — but the decision proceeds as if the validation path were sound.
- Detection: `mvp_planning_output.assumption_inversion_detected == true` and the inversion is not reflected as a cap or open risk.
- Severity: `major`.
- Action: Cap at PROCEED WITH CAUTION. The fastest next action must redirect to validating the lowest unvalidated assumption layer before building.

**8. Untraceable Decision**
A primary decision factor cannot be traced to an `evidence_ledger[]` entry, or a dimension score has no `ledger_refs`. The decision rests on assertion rather than evidence.
- Detection: Any `decision_rationale.primary_factors[].ledger_ref` is empty, or any `dimension_scores[].ledger_refs` is empty.
- Severity: `major`.
- Action: Either locate the supporting upstream finding and cite it, or remove the factor from the rationale. A decision factor with no evidence behind it is an opinion and must not influence the output.

**9. No Counter-Argument**
The output presents a one-sided case. A PROCEED with no bear case, or a DO NOT BUILD with no acknowledgment of what might make it worth reconsidering.
- Detection: `decision_rationale.strongest_counterargument` is empty, or `bear_case` is empty on a proceed decision.
- Severity: `major`.
- Action: Require the counter-argument. A decision that cannot articulate its own strongest objection has not been stress-tested and is not defensible to the investment committee.

**10. Confidence Inflated Above Trust**
`decision_confidence` exceeds what the Verification trustworthiness score supports. The synthesis projects certainty the underlying analysis does not justify.
- Detection: `decision_confidence` violates a ceiling in the Confidence Criteria table — most commonly `decision_confidence > 50` while `trustworthiness_score < 55`.
- Severity: `major`.
- Action: Lower `decision_confidence` to the applicable ceiling. Decision confidence can never exceed the trustworthiness of the evidence it is built on.

**11. False Negative from Thin Evidence**
A DO NOT BUILD is issued not because the idea is weak but because the upstream analysis was thin — low confidence across agents, many unknowns — and the absence of evidence was read as evidence of absence.
- Detection: `decision == "DO NOT BUILD"` while upstream merit scores are not actually low, but `evidence_ledger[]` is dominated by `weak` entries and unresolved unknowns.
- Severity: `major`.
- Action: Distinguish "the evidence shows this is weak" from "there isn't enough evidence to decide." If the latter, the decision is PROCEED WITH CAUTION with a fastest next action targeting the missing evidence — not DO NOT BUILD. Reserve DO NOT BUILD for ideas shown to be weak, or for untrustworthy analysis.
