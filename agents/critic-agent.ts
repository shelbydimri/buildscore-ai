import type { CriticAgentInput, VerificationOutput } from '../types/agent-types';

export class CriticAgent {
  constructor() {}

  async execute(input: CriticAgentInput): Promise<VerificationOutput> {
    this.validate(input);
    throw new Error('Not Implemented');
  }

  private validate(input: CriticAgentInput): void {
    if (!input.define_output) {
      throw new Error('CriticAgent: input.define_output is required');
    }
    if (!input.market_analysis_output) {
      throw new Error('CriticAgent: input.market_analysis_output is required');
    }
    if (!input.competitor_analysis_output) {
      throw new Error('CriticAgent: input.competitor_analysis_output is required');
    }
    if (!input.mvp_planning_output) {
      throw new Error('CriticAgent: input.mvp_planning_output is required');
    }
    if (input.loop_count < 1 || input.loop_count > 3) {
      throw new Error('CriticAgent: input.loop_count must be 1, 2, or 3');
    }
    if (input.loop_count > 1 && !input.prior_verification_output) {
      throw new Error('CriticAgent: input.prior_verification_output is required when loop_count > 1');
    }
  }
}
