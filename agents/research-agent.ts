import type {
  ResearchAgentInput,
  MarketAnalysisOutput,
  CompetitorAnalysisOutput,
} from '../types/agent-types';

export interface ResearchAgentOutput {
  market_analysis_output: MarketAnalysisOutput;
  competitor_analysis_output: CompetitorAnalysisOutput;
}

export class ResearchAgent {
  constructor() {}

  async execute(input: ResearchAgentInput): Promise<ResearchAgentOutput> {
    this.validate(input);
    throw new Error('Not Implemented');
  }

  private validate(input: ResearchAgentInput): void {
    if (!input.define_output) {
      throw new Error('ResearchAgent: input.define_output is required');
    }
    if (input.define_output.analysis_status === 'insufficient_input') {
      throw new Error('ResearchAgent: define_output.analysis_status is insufficient_input — pipeline should have halted');
    }
  }
}
