import { DefineAgent } from '../agents/define-agent';
import { ResearchAgent } from '../agents/research-agent';
import type { ResearchAgentOutput } from '../agents/research-agent';
import { StrategyAgent } from '../agents/strategy-agent';
import { CriticAgent } from '../agents/critic-agent';
import { CEOAgent } from '../agents/ceo-agent';
import { PipelineStateManager, MissingInputError } from './pipeline-state';
import { RunLogger } from '../src/logging/run-logger';
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

// Memory integration types are defined in orchestrator-types.ts (MemoryReadContext,
// MemoryWritePayload) but are not yet wired into the orchestrator. Defer until v1.1.
// The run() method will read memory before Define and write memory after CEO in future.

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
  private readonly runLogger:     RunLogger;

  constructor() {
    this.defineAgent   = new DefineAgent();
    this.researchAgent = new ResearchAgent();
    this.strategyAgent = new StrategyAgent();
    this.criticAgent   = new CriticAgent();
    this.ceoAgent      = new CEOAgent();
    this.runLogger     = new RunLogger();
  }

  // ── Public entry point ─────────────────────────────────────────────────────

  async run(input: DefineAgentInput, runId?: string): Promise<OrchestratorOutput> {
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
      const output = await this.execute(run, state, input);
      await this.runLogger.saveRun(run.run_id, input, output);
      return output;
    } catch (signal) {
      if (signal instanceof HaltSignal) {
        run.halt_reason = signal.reason;
        const output = {
          run_id:          run.run_id,
          outcome:         'halt',
          halt_reason:     signal.reason,
          halt_stage:      signal.stage,
          what_is_needed:  signal.whatIsNeeded,
          partial_state:   state.getSnapshot(),
        } as OrchestratorHaltOutput;
        await this.runLogger.saveRun(run.run_id, input, output);
        return output;
      }
      throw signal; // unexpected — re-throw
    }
  }

  // ── Pipeline execution ─────────────────────────────────────────────────────

  private async execute(
    run:   OrchestratorRun,
    state: PipelineStateManager,
    input: DefineAgentInput,
  ): Promise<OrchestratorDecisionOutput> {

    // ── Stage 1: Define ───────────────────────────────────────────────────────
    console.log(`[${new Date().toISOString()}] START: define-agent`);
    const defineOutput = await this.callWithRetry(
      () => this.defineAgent.execute(input),
      'define-agent',
    );
    console.log(`[${new Date().toISOString()}] END: define-agent`);
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
    console.log(`[${new Date().toISOString()}] START: research-agent (market-analysis + competitor-analysis)`);
    const researchOutput: ResearchAgentOutput = await this.callWithRetry(
      () => this.researchAgent.execute({
        define_output:  defineOutput,
        founder_brief:  input.idea,
      }),
      'research-agent',
    );
    console.log(`[${new Date().toISOString()}] END: research-agent`);
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
    // The Critic Agent (via the verification skill) is responsible for loop-limit logic:
    // On loop_count == 3, if trustworthiness_score is 55-74 and all remaining issues are minor,
    // the Critic must upgrade verdict from "revise" to "approve" with ceo_caveats populated.
    // This prevents an infinite loop and surfaces caveats to the CEO Agent.
    let priorVerification: VerificationOutput | undefined;
    let verification!: VerificationOutput;

    while (run.loop_count < MAX_LOOP_COUNT) {
      run.loop_count++;

      // Stage 3: Strategy (mvp-planning)
      console.log(`[${new Date().toISOString()}] START: strategy-agent (loop ${run.loop_count})`);
      const strategyOutput = await this.callWithRetry(
        () => this.strategyAgent.execute({
          define_output:              defineOutput,
          market_analysis_output:     state.requireMarketAnalysisOutput(),
          competitor_analysis_output: state.requireCompetitorAnalysisOutput(),
          required_revisions:         priorVerification?.required_revisions,
        }),
        'strategy-agent',
      );
      console.log(`[${new Date().toISOString()}] END: strategy-agent (loop ${run.loop_count})`);
      state.setMvpPlanningOutput(strategyOutput);

      // Stage 4: Critic (verification)
      console.log(`[${new Date().toISOString()}] START: critic-agent (loop ${run.loop_count})`);
      verification = await this.callWithRetry(
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
      console.log(`[${new Date().toISOString()}] END: critic-agent (loop ${run.loop_count}, verdict: ${verification.verdict})`);
      state.setVerificationOutput(verification);
      run.pipeline_state = state.getSnapshot();

      run.loop_history.push({
        loop_count:            run.loop_count,
        verdict:               verification.verdict,
        trustworthiness_score: verification.trustworthiness_score,
        required_revisions:    verification.required_revisions,
        completed_at:          new Date().toISOString(),
      });

      // Route by pipeline_recommendation.action (canonical signal for next step)
      const action = verification.pipeline_recommendation.action;

      if (action === 'return_to_define') {
        // If at max loop count, proceed to CEO with caveat instead of halting.
        // The problem definition is broken, but continuing loops won't help; CEO must see the unresolved issue.
        if (run.loop_count >= MAX_LOOP_COUNT) {
          break;
        }
        // Before max loops, halt for founder feedback.
        throw new HaltSignal(
          'return_to_define',
          'critic-agent',
          verification.required_revisions.map(r => r.resolution),
        );
      }

      if (action === 'proceed_to_ceo') {
        // Exit to CEO (both 'approve' and 'reject' verdicts route here)
        break;
      }

      if (action === 'return_to_strategy') {
        // Loop back to Strategy. On loop_count == 3, the loop condition will fail
        // and we exit to CEO Agent (the Critic should have already applied the loop-limit upgrade).
        priorVerification = verification;
        continue;
      }

      // Unexpected action — should never happen if critic agent is correct
      throw new HaltSignal(
        'contract_violation',
        'critic-agent',
        [`Unexpected pipeline_recommendation.action: "${String(action)}"`],
      );
    }

    // ── Stage 5: CEO (startup-validation) ────────────────────────────────────
    console.log(`[${new Date().toISOString()}] START: ceo-agent`);
    const ceoOutput: StartupValidationOutput = await this.callWithRetry(
      () => this.ceoAgent.execute({
        define_output:              defineOutput,
        market_analysis_output:     state.requireMarketAnalysisOutput(),
        competitor_analysis_output: state.requireCompetitorAnalysisOutput(),
        mvp_planning_output:        state.requireMvpPlanningOutput(),
        verification_output:        state.requireVerificationOutput(),
      }),
      'ceo-agent',
    );
    console.log(`[${new Date().toISOString()}] END: ceo-agent (decision: ${ceoOutput.decision})`);
    state.setStartupValidationOutput(ceoOutput);
    run.final_decision  = ceoOutput.decision;
    run.pipeline_state  = state.getSnapshot();

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
  // Awaits fn(). On any failure, retries once.
  // If the retry also fails, throws HaltSignal so the pipeline stops cleanly.

  private async callWithRetry<T>(fn: () => Promise<T>, agentName: AgentName): Promise<T> {
    try {
      return await fn();
    } catch {
      try {
        return await fn();
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
