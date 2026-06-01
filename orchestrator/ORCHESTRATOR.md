# BuildScore AI — Orchestrator

The orchestrator is the control plane for the BuildScore pipeline. It does not analyze ideas itself. It sequences the five agents, passes state between them, enforces the gates and the feedback loop, and decides when the pipeline has produced a trustworthy decision — or when it must stop and ask for more input.

**Mission it serves:** Help founders decide whether an idea is worth building.

**Operating principle:** The orchestrator is deterministic and evidence-first. It never improvises a decision, never skips an agent to save time, and never lets a downstream agent run on input an upstream agent flagged as insufficient. Garbage in is stopped at the gate, not laundered downstream.

---

## 1. Architecture

```
Define ───────► Do ───────────────────► Verify ──────► Decision
   │             │                          │
   ▼             ▼                          ▼
Define Agent  Research Agent           Critic Agent
              Strategy Agent           CEO Agent
```

Five agents across three phases. Each agent runs one or more of the completed skills.

| # | Agent | Phase | Skill(s) invoked | Produces |
|---|-------|-------|------------------|----------|
| 1 | Define Agent | Define | `define-problem` | Problem definition, pain profile, assumptions |
| 2 | Research Agent | Do | `market-analysis`, `competitor-analysis` | Market attractiveness, competitive landscape |
| 3 | Strategy Agent | Do | `mvp-planning` | Core assumption, validation experiment, MVP scope |
| 4 | Critic Agent | Verify | `verification` | Trust verdict, trustworthiness score, required revisions |
| 5 | CEO Agent | Verify | `startup-validation` | Final decision: PROCEED / PROCEED WITH CAUTION / DO NOT BUILD |

**Note on the Investment Agent.** Earlier drafts of this pipeline included a separate Investment Agent. In the current five-agent model its concerns are distributed, not dropped: monetization and willingness-to-pay evidence are produced by the Research Agent (`market-analysis`), and the investment-grade go/no-go judgment is made by the CEO Agent (`startup-validation`), which applies the venture-committee lens. There is no standalone investment stage.

---

## 2. Execution Sequence and Data Flow

Agents run in strict order. Each agent consumes the accumulated outputs of all prior agents — not a summary, the full structured outputs. The orchestrator maintains a single `pipeline_state` object and appends each agent's output to it.

```
INPUT: founder_brief (raw idea, optional context)
  │
  ▼
[1] DEFINE AGENT  ──► define_output
  │   gate: if analysis_status == "insufficient_input" → HALT (see §5)
  ▼
[2] RESEARCH AGENT
  │   ├─ market-analysis      ──► market_analysis_output   (consumes: define_output)
  │   └─ competitor-analysis  ──► competitor_analysis_output (consumes: define_output, market_analysis_output)
  │   gate: if either returns "blocked_by_define" → HALT
  ▼
[3] STRATEGY AGENT  ──► mvp_planning_output
  │   consumes: define_output, market_analysis_output, competitor_analysis_output
  ▼
[4] CRITIC AGENT  ──► verification_output   (loop_count tracked here)
  │   consumes: ALL of the above
  │   ROUTING (see §4):
  │     verdict == "approve" ────────────► proceed to [5]
  │     verdict == "revise"  ────────────► loop back to [3] Strategy (if loop_count < 3)
  │     verdict == "reject"  ────────────► proceed to [5] with trust-gate failure
  ▼
[5] CEO AGENT  ──► startup_validation_output  (the final decision)
  │   consumes: ALL of the above, with verification_output as the trust gate
  ▼
OUTPUT: final decision + traceable rationale (see §8)
```

**Why the full outputs flow forward, not summaries.** Every skill in this pipeline was built to consume specific upstream fields (e.g., `mvp-planning` reads `define_output.assumptions[]` directly; `startup-validation` reads `verification_output.verdict`). Summarizing between stages would break that field-level traceability and is prohibited. The orchestrator passes structured JSON, unmodified.

---

## 3. The Shared State Contract

The orchestrator carries one object through the run:

```json
{
  "run_id": "",
  "founder_brief": "",
  "loop_count": 0,
  "pipeline_state": {
    "define_output": null,
    "market_analysis_output": null,
    "competitor_analysis_output": null,
    "mvp_planning_output": null,
    "verification_output": null,
    "startup_validation_output": null
  },
  "loop_history": [],
  "halt_reason": null,
  "final_decision": null
}
```

**Every agent output must conform to the shared output schema:** structured JSON, with `agent`, `confidence`, `analysis_status`, `assumptions`, and `reasoning` present. The orchestrator validates this shape on receipt. An output missing `confidence`, `analysis_status`, or returning non-JSON is a contract violation — the orchestrator does not pass it forward (see §6).

**`loop_history`** records every Critic verdict and the revisions requested, so that on a second or third pass the Critic can be given `prior_verification_output` and check whether prior issues were resolved (the `verification` skill requires this).

---

## 4. The Feedback Loop

The loop exists for one reason: to let the Strategy Agent repair recoverable problems the Critic found, before a decision is made. It is bounded and audited.

**Loop trigger:** Critic Agent returns `verification_output.verdict == "revise"`.

**Loop target:** Strategy Agent (step 3). The Strategy Agent re-runs `mvp-planning` with the Critic's `required_revisions[]` as additional input. If a revision targets the Research outputs, the orchestrator re-runs the relevant Research skill first, then Strategy.

**Loop bound:** Maximum 3 Critic passes (`loop_count` ∈ {1, 2, 3}).

**Per-pass routing:**

| Critic verdict | loop_count < 3 | loop_count == 3 |
|----------------|----------------|-----------------|
| `approve` | → CEO Agent | → CEO Agent |
| `revise` | → increment loop_count, return to Strategy | → **stop looping**, → CEO Agent with unresolved revisions surfaced |
| `reject` | → CEO Agent (trust-gate failure) | → CEO Agent (trust-gate failure) |

**Loop-limit semantics (must match the `verification` skill):** On `loop_count == 3`, the Critic does not start a fourth loop. If only minor issues remain, it returns `approve` with `pipeline_recommendation.ceo_caveats` populated. If major or critical issues remain, it returns `reject`. Either way the orchestrator advances to the CEO Agent — the loop never exceeds three passes.

**What the loop must never do:**
- Loop forever. The cap is hard at 3.
- Silently approve to escape the loop. Every unresolved issue is carried into `ceo_caveats` and into the final output.
- Re-run the Define Agent. The loop repairs strategy and (if needed) research. If the *problem definition itself* is the root failure, the Critic returns `verdict == "reject"` with `pipeline_recommendation.action == "return_to_define"`, and the orchestrator HALTS to the founder (§5) rather than looping — a broken problem definition cannot be fixed by re-strategizing.

---

## 5. Gates and Halt Conditions

The orchestrator halts the pipeline early — returning to the founder rather than proceeding — when an upstream agent reports that it cannot do its job on the input available. Proceeding past these gates produces confident-looking nonsense.

| Gate | Condition | Action |
|------|-----------|--------|
| Define gate | `define_output.analysis_status == "insufficient_input"` | HALT. Return the Define Agent's `critical_unknowns` to the founder as the questions that must be answered before analysis can run. Do not run Research. |
| Research gate | `market_analysis_output.analysis_status == "blocked_by_define"` or same on competitor | HALT. The problem definition was too weak to bound the market. Return to founder with what Define must resolve. |
| Problem-root gate | `verification_output.pipeline_recommendation.action == "return_to_define"` | HALT. The Critic judged the problem definition itself to be the root failure. Looping cannot fix this. Return to founder. |
| Contract gate | Any agent returns non-conforming output (no `confidence`, no `analysis_status`, non-JSON) | Retry that agent once (§6). If it fails again, HALT with `halt_reason: "contract_violation"`. |

A HALT is not a failure of the system — it is the system correctly refusing to fabricate. The halt output tells the founder exactly what is missing.

---

## 6. Error Handling

**Contract violation (malformed output):** Retry the offending agent exactly once with an instruction to conform to the shared output schema. If the retry also fails, HALT with `halt_reason: "contract_violation"` and identify the agent. Never hand-repair an agent's JSON and pass it forward as if the agent produced it.

**Missing upstream input:** If an agent is reached without a required input present in `pipeline_state` (e.g., Strategy reached with `market_analysis_output == null`), this is an orchestration bug. HALT with `halt_reason: "missing_input"` and name the missing field. Do not let the agent run on partial input — the downstream skills have input-validation gates precisely because partial input produces unreliable output.

**Agent timeout or execution failure:** Retry once. On second failure, HALT with `halt_reason: "agent_failure"` and the agent name. Record partial `pipeline_state` so the run can be resumed rather than restarted.

**The orchestrator never invents agent output.** If an agent cannot produce a result, the orchestrator stops. A pipeline that fabricates a missing stage to reach a decision is worse than no decision.

---

## 7. Confidence Propagation

Each agent emits its own `confidence`. The orchestrator does not average these into a single number — the CEO Agent's `startup-validation` skill is responsible for synthesizing confidence, dominated by the Critic's `trustworthiness_score`. The orchestrator's job is narrower:

- **Carry, don't collapse.** Every agent's confidence is preserved in `pipeline_state` so the CEO Agent can detect disagreement (wide spread across agents lowers final decision confidence).
- **Respect upstream ceilings.** The skills impose their own confidence ceilings (e.g., `market-analysis` caps at 55 when `define_output.confidence < 40`). The orchestrator does not override these and does not re-run an agent to chase a higher number.
- **The loop threshold is the Critic's, not a global one.** The pipeline loops on `verdict == "revise"`, which the `verification` skill ties to its trustworthiness scoring (an approve requires `trustworthiness_score >= 75` absent blocking issues). The orchestrator routes on the verdict, not on a raw confidence comparison.

---

## 8. Termination and Final Output

The pipeline terminates in exactly one of two ways:

**A. Decision reached** — The CEO Agent produced `startup_validation_output`. The orchestrator emits:

```json
{
  "run_id": "",
  "outcome": "decision",
  "decision": "PROCEED | PROCEED WITH CAUTION | DO NOT BUILD",
  "decision_status": "complete | pending_revision | untrustworthy_analysis | incomplete_pipeline",
  "decision_confidence": 0,
  "rationale": "<startup_validation_output.decision_rationale>",
  "fastest_next_action": "<startup_validation_output.fastest_next_action>",
  "open_risks": "<startup_validation_output.open_risks>",
  "loop_count": 0,
  "evidence_trace": "<startup_validation_output.evidence_ledger>"
}
```

The decision is always traceable: `evidence_trace` carries the CEO Agent's evidence ledger, so any reviewer can follow each decision factor back to the upstream agent and field it came from.

**B. Halt** — A gate (§5) or unrecoverable error (§6) stopped the pipeline. The orchestrator emits:

```json
{
  "run_id": "",
  "outcome": "halt",
  "halt_reason": "insufficient_input | blocked_by_define | return_to_define | contract_violation | missing_input | agent_failure",
  "halt_stage": "",
  "what_is_needed": [],
  "partial_state": "<pipeline_state as far as it completed>"
}
```

A halt is a first-class outcome, not an error to be hidden. `what_is_needed` gives the founder the concrete questions or fixes required to make the run succeed on retry.

---

## 9. Invariants

These hold for every run. They are the contract the orchestrator guarantees.

1. **Order is fixed.** Define → Research → Strategy → Critic → CEO. No agent runs before its inputs exist.
2. **No stage is skipped.** Even when an early signal looks decisive, every agent runs. Confidence in the final decision depends on the full evidence trail.
3. **The loop is bounded at 3 and audited.** Every pass is recorded in `loop_history`; no pass is silent.
4. **Gates halt; they do not guess.** Insufficient input stops the pipeline and returns specific questions — it never proceeds on fabricated specifics.
5. **Structured outputs flow forward unmodified.** No summarization between stages; field-level traceability is preserved end to end.
6. **The CEO Agent owns the decision; the Critic owns the trust gate.** The orchestrator routes between them but never makes the decision itself.
7. **Every terminal output is traceable or explicitly halted.** A decision carries its evidence ledger; a halt carries what is needed to proceed.
8. **The orchestrator never fabricates.** Missing or malformed agent output stops the run — it is never invented, averaged over, or hand-patched into the appearance of a real result.

## 10. Memory Integration

Memory Read Phase

Before Define Agent:

Read:

- founder-preferences.md
- market-patterns.md
- decision-history.md

Purpose:

Provide historical context.

Memory Write Phase

After CEO Agent:

Store:

- Final decision
- Confidence
- Key risks
- Market learnings
- Failed assumptions

Purpose:

Improve future analyses.