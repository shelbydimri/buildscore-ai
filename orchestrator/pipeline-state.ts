import type { PipelineState } from '../types/orchestrator-types';
import type {
  DefineOutput,
  MarketAnalysisOutput,
  CompetitorAnalysisOutput,
  MvpPlanningOutput,
  VerificationOutput,
  StartupValidationOutput,
} from '../types/agent-types';

// Thrown by require* getters when an agent output is missing.
// The orchestrator catches this and halts with reason 'missing_input'.
export class MissingInputError extends Error {
  constructor(public readonly field: keyof PipelineState) {
    super(`MissingInputError: ${field} is null — agent has not run or output was not stored`);
    this.name = 'MissingInputError';
  }
}

export class PipelineStateManager {
  private state: PipelineState;

  constructor() {
    this.state = {
      define_output:              null,
      market_analysis_output:     null,
      competitor_analysis_output: null,
      mvp_planning_output:        null,
      verification_output:        null,
      startup_validation_output:  null,
    };
  }

  // Returns a shallow copy so callers cannot mutate the live state.
  getSnapshot(): PipelineState {
    return { ...this.state };
  }

  // ── Setters ────────────────────────────────────────────────────────────────
  // Each setter appends one agent's output to the accumulated state.
  // Outputs flow forward unmodified — no summarisation between stages.

  setDefineOutput(output: DefineOutput): void {
    this.state.define_output = output;
  }

  setMarketAnalysisOutput(output: MarketAnalysisOutput): void {
    this.state.market_analysis_output = output;
  }

  setCompetitorAnalysisOutput(output: CompetitorAnalysisOutput): void {
    this.state.competitor_analysis_output = output;
  }

  setMvpPlanningOutput(output: MvpPlanningOutput): void {
    this.state.mvp_planning_output = output;
  }

  setVerificationOutput(output: VerificationOutput): void {
    this.state.verification_output = output;
  }

  setStartupValidationOutput(output: StartupValidationOutput): void {
    this.state.startup_validation_output = output;
  }

  // ── Getters ────────────────────────────────────────────────────────────────
  // Each getter throws MissingInputError if the output is null.
  // This enforces pipeline order: an agent cannot run before its dependencies exist.

  requireDefineOutput(): DefineOutput {
    if (!this.state.define_output) throw new MissingInputError('define_output');
    return this.state.define_output;
  }

  requireMarketAnalysisOutput(): MarketAnalysisOutput {
    if (!this.state.market_analysis_output) throw new MissingInputError('market_analysis_output');
    return this.state.market_analysis_output;
  }

  requireCompetitorAnalysisOutput(): CompetitorAnalysisOutput {
    if (!this.state.competitor_analysis_output) throw new MissingInputError('competitor_analysis_output');
    return this.state.competitor_analysis_output;
  }

  requireMvpPlanningOutput(): MvpPlanningOutput {
    if (!this.state.mvp_planning_output) throw new MissingInputError('mvp_planning_output');
    return this.state.mvp_planning_output;
  }

  requireVerificationOutput(): VerificationOutput {
    if (!this.state.verification_output) throw new MissingInputError('verification_output');
    return this.state.verification_output;
  }

  requireStartupValidationOutput(): StartupValidationOutput {
    if (!this.state.startup_validation_output) throw new MissingInputError('startup_validation_output');
    return this.state.startup_validation_output;
  }
}
