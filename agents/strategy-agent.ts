import type { StrategyAgentInput, MvpPlanningOutput } from '../types/agent-types';

export class StrategyAgent {
  constructor() {}

  execute(input: StrategyAgentInput): MvpPlanningOutput {
    this.validate(input);
    throw new Error('Not Implemented');
  }

  private validate(input: StrategyAgentInput): void {
    if (input.define_output.analysis_status === 'insufficient_input') {
      throw new Error('StrategyAgent: define_output.analysis_status is insufficient_input — pipeline should have halted');
    }
  }
}
