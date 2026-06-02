import { DefineAgent } from '../agents/define-agent';
import { ResearchAgent } from '../agents/research-agent';
import type { ResearchAgentOutput } from '../agents/research-agent';
import { StrategyAgent } from '../agents/strategy-agent';
import { CriticAgent } from '../agents/critic-agent';
import { CEOAgent } from '../agents/ceo-agent';
import { PipelineStateManager, MissingInputError } from './pipeline-state';
import type {
  OrchestratorRun,
  OrchestratorOutput,
  OrchestratorDecisionOutput,
  OrchestratorHaltOutput,
  HaltReason,
  AgentName,
} from '../types/orchestrator-types';
import type {
  DefineAgentInput,
  VerificationOutput,
  StartupValidationOutput,
} from '../types/agent-types';

const MAX_LOOP_COUNT = 3;

// ─── Internal halt signal ─────────────────────────────────────────────────────
// Thrown by any gate check or retry exhaustion to unwind the call stack.
// Caught exactly once in run() and converted into an OrchestratorHaltOutput.

class HaltSignal {
  constructor(
    public readonly reason: HaltReason,
    public readonly stage: AgentName,
    public readonly whatIsNeeded: string[],
  ) {}
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class Orchestrator {
  private readonly defineAgent:   DefineAgent;
  private readonly researchAgent: ResearchAgent;
  private readonly strategyAgent: StrategyAgent;
  private readonly criticAgent:   CriticAgent;
  private readonly ceoAgent:      CEOAgent;

  constructor() {
    this.defineAgent   = new DefineAgent();
    this.researchAgent = new ResearchAgent();
    this.strategyAgent = new StrategyAgent();
    this.criticAgent   = new CriticAgent();
    this.ceoAgent      = new CEOAgent();
  }

  // ── Public entry point ─────────────────────────────────────────────────────

  run(input: DefineAgentInput, runId?: string): OrchestratorOutput {
    const run: OrchestratorRun = {
      run_id:         runId ?? generateRunId(),
      founder_brief:  input.idea,
      loop_count:     0,
      pipeline_state: {
        define_output:              null,
        market_analysis_output:     null,
        competitor_analysis_output: null,
        mvp_planning_output:        null,
        verification_output:        null,
        startup_validation_output:  null,
      },
      loop_history:  [],
      halt_reason:   null,
      final_decision: null,
    };

    const state = new PipelineStateManager();

    try {
      return this.execute(run, state, input);
    } catch (signal) {
      if (signal instanceof HaltSignal) {
        run.halt_reason = signal.reason;
        return {
          run_id:          run.run_id,
          outcome:         'halt',
          halt_reason:     signal.reason,
          halt_stage:      signal.stage,
          what_is_needed:  signal.whatIsNeeded,
          partial_state:   state.getSnapshot(),
        } as OrchestratorHaltOutput;
      }
      throw signal; // unexpected — re-throw
    }
  }

  // ── Pipeline execution ─────────────────────────────────────────────────────

  private execute(
    run:   OrchestratorRun,
    state: PipelineStateManager,
    input: DefineAgentInput,
  ): OrchestratorDecisionOutput {

    // ── Stage 1: Define ───────────────────────────────────────────────────────
    const defineOutput = this.callWithRetry(
      () => this.defineAgent.execute(input),
      'define-agent',
    );
    state.setDefineOutput(defineOutput);
    run.pipeline_state = state.getSnapshot();

    // Gate — Define: idea too vague to analyse
    if (defineOutput.analysis_status === 'insufficient_input') {
      throw new HaltSignal(
        'insufficient_input',
        'define-agent',
        defineOutput.critical_unknowns.map(u => u.question),
      );
    }

    // ── Stage 2: Research (market-analysis + competitor-analysis) ─────────────
    const researchOutput: ResearchAgentOutput = this.callWithRetry(
      () => this.researchAgent.execute({
        define_output:  defineOutput,
        founder_brief:  input.idea,
      }),
      'research-agent',
    );
    state.setMarketAnalysisOutput(researchOutput.market_analysis_output);
    state.setCompetitorAnalysisOutput(researchOutput.competitor_analysis_output);
    run.pipeline_state = state.getSnapshot();

    // Gate — Research: Define output was too weak to bound the market or competitor scope
    if (
      researchOutput.market_analysis_output.analysis_status     === 'blocked_by_define' ||
      researchOutput.competitor_analysis_output.analysis_status === 'blocked_by_define'
    ) {
      throw new HaltSignal(
        'blocked_by_define',
        'research-agent',
        defineOutput.critical_unknowns.map(u => u.question),
      );
    }

    // ── Stages 3 & 4: Strategy → Critic loop (max MAX_LOOP_COUNT passes) ──────
    let priorVerification: VerificationOutput | undefined;
    let verification!: VerificationOutput;

    while (run.loop_count < MAX_LOOP_COUNT) {
      run.loop_count++;

      // Stage 3: Strategy (mvp-planning)
      const strategyOutput = this.callWithRetry(
        () => this.strategyAgent.execute({
          define_output:              defineOutput,
          market_analysis_output:     state.requireMarketAnalysisOutput(),
          competitor_analysis_output: state.requireCompetitorAnalysisOutput(),
          required_revisions:         priorVerification?.required_revisions,
        }),
        'strategy-agent',
      );
      state.setMvpPlanningOutput(strategyOutput);

      // Stage 4: Critic (verification)
      verification = this.callWithRetry(
        () => this.criticAgent.execute({
          define_output:              defineOutput,
          market_analysis_output:     state.requireMarketAnalysisOutput(),
          competitor_analysis_output: state.requireCompetitorAnalysisOutput(),
          mvp_planning_output:        strategyOutput,
          loop_count:                 run.loop_count,
          prior_verification_output:  priorVerification,
        }),
        'critic-agent',
      );
      state.setVerificationOutput(verification);
      run.pipeline_state = state.getSnapshot();

      run.loop_history.push({
        loop_count:           run.loop_count,
        verdict:              verification.verdict,
        trustworthiness_score: verification.trustworthiness_score,
        required_revisions:   verification.required_revisions,
        completed_at:         new Date().toISOString(),
      });

      // Gate — Problem root: the problem definition itself is broken; looping cannot fix it
      if (verification.pipeline_recommendation.action === 'return_to_define') {
        throw new HaltSignal(
          'return_to_define',
          'critic-agent',
          verification.required_revisions.map(r => r.resolution),
        );
      }

      // approve → exit loop → proceed to CEO
      if (verification.verdict === 'approve') break;

      // reject → exit loop → proceed to CEO (trust gate will fail)
      if (verification.verdict === 'reject') break;

      // revise → loop back to Strategy with required_revisions in hand
      priorVerification = verification;
    }
    // If loop_count reaches MAX_LOOP_COUNT without approve/reject, Critic's own
    // loop-limit logic (SKILL.md §Loop awareness) will have produced a verdict
    // of approve+caveats or reject on the final pass — either way we proceed.

    // ── Stage 5: CEO (startup-validation) ────────────────────────────────────
    const ceoOutput: StartupValidationOutput = this.callWithRetry(
      () => this.ceoAgent.execute({
        define_output:              defineOutput,
        market_analysis_output:     state.requireMarketAnalysisOutput(),
        competitor_analysis_output: state.requireCompetitorAnalysisOutput(),
        mvp_planning_output:        state.requireMvpPlanningOutput(),
        verification_output:        state.requireVerificationOutput(),
      }),
      'ceo-agent',
    );
    state.setStartupValidationOutput(ceoOutput);
    run.final_decision   = ceoOutput.decision;
    run.pipeline_state   = state.getSnapshot();

    return {
      run_id:              run.run_id,
      outcome:             'decision',
      decision:            ceoOutput.decision,
      decision_status:     ceoOutput.decision_status,
      decision_confidence: ceoOutput.decision_confidence,
      rationale:           ceoOutput.decision_rationale,
      fastest_next_action: ceoOutput.fastest_next_action,
      open_risks:          ceoOutput.open_risks,
      loop_count:          run.loop_count,
      evidence_trace:      ceoOutput.evidence_ledger,
    } as OrchestratorDecisionOutput;
  }

  // ── Retry wrapper ──────────────────────────────────────────────────────────
  // Calls fn(). On any failure, retries once.
  // If the retry also fails, throws HaltSignal so the pipeline stops cleanly.

  private callWithRetry<T>(fn: () => T, agentName: AgentName): T {
    try {
      return fn();
    } catch {
      try {
        return fn();
      } catch (secondError) {
        const reason: HaltReason = secondError instanceof MissingInputError
          ? 'missing_input'
          : 'contract_violation';
        const message = secondError instanceof Error
          ? secondError.message
          : String(secondError);
        throw new HaltSignal(reason, agentName, [message]);
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
