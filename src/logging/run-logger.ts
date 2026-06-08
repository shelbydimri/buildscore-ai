import { promises as fs } from 'fs';
import * as path from 'path';
import type { DefineAgentInput, StartupValidationOutput } from '../../types/agent-types';
import type { OrchestratorOutput, OrchestratorDecisionOutput } from '../../types/orchestrator-types';

interface RunLog {
  jobId: string;
  timestamp: string;
  input: {
    idea: string;
    targetUser?: string;
    founderContext?: string;
    priorResearch?: string;
  };
  output?: {
    decision: string;
    decisionConfidence: number;
    decisionStatus: string;
  };
  outcome: 'decision' | 'halt';
}

export class RunLogger {
  private logsDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.logsDir = path.join(baseDir, 'logs');
  }

  async ensureLogsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
    } catch (err) {
      // Directory may already exist or be inaccessible; log but don't fail the pipeline
      console.warn(`[RunLogger] Could not create logs directory: ${String(err)}`);
    }
  }

  async saveRun(
    jobId: string,
    input: DefineAgentInput,
    output: OrchestratorOutput,
  ): Promise<void> {
    try {
      await this.ensureLogsDirectory();

      const runLog: RunLog = {
        jobId,
        timestamp: new Date().toISOString(),
        input: {
          idea: input.idea,
          targetUser: input.target_user,
          founderContext: input.founder_context,
          priorResearch: input.prior_research,
        },
        outcome: output.outcome,
      };

      // Populate decision output if available
      if (output.outcome === 'decision') {
        const decisionOutput = output as OrchestratorDecisionOutput;
        runLog.output = {
          decision: decisionOutput.decision,
          decisionConfidence: decisionOutput.decision_confidence,
          decisionStatus: decisionOutput.decision_status,
        };
      }

      const filename = `run-${jobId}.json`;
      const filepath = path.join(this.logsDir, filename);
      await fs.writeFile(filepath, JSON.stringify(runLog, null, 2), 'utf-8');

      console.log(`[RunLogger] Saved run log: ${filename}`);
    } catch (err) {
      // Log errors but don't fail the pipeline
      console.error(`[RunLogger] Error saving run: ${String(err)}`);
    }
  }
}
