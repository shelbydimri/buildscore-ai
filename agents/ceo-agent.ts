import type { CEOAgentInput, StartupValidationOutput } from '../types/agent-types';

export class CEOAgent {
  constructor() {}

  execute(input: CEOAgentInput): StartupValidationOutput {
    this.validate(input);
    throw new Error('Not Implemented');
  }

  private validate(input: CEOAgentInput): void {
    if (!input.define_output) {
      throw new Error('CEOAgent: input.define_output is required');
    }
    if (!input.market_analysis_output) {
      throw new Error('CEOAgent: input.market_analysis_output is required');
    }
    if (!input.competitor_analysis_output) {
      throw new Error('CEOAgent: input.competitor_analysis_output is required');
    }
    if (!input.mvp_planning_output) {
      throw new Error('CEOAgent: input.mvp_planning_output is required');
    }
    if (!input.verification_output) {
      throw new Error('CEOAgent: input.verification_output is required — this is the trust gate');
    }
  }
}
