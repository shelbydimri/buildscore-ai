import type { DefineAgentInput, DefineOutput } from '../types/agent-types';

export class DefineAgent {
  constructor() {}

  execute(input: DefineAgentInput): DefineOutput {
    this.validate(input);
    throw new Error('Not Implemented');
  }

  private validate(input: DefineAgentInput): void {
    if (!input.idea || input.idea.trim() === '') {
      throw new Error('DefineAgent: input.idea is required');
    }
  }
}
