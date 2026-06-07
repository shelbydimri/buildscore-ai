import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { Orchestrator } from '../../orchestrator/orchestrator';
import type { DefineAgentInput } from '../../types/agent-types';
import type {
  OrchestratorOutput,
  OrchestratorDecisionOutput,
  OrchestratorHaltOutput,
} from '../../types/orchestrator-types';

const app = express();
const PORT = process.env.PORT || 3000;
const TEST_MODE = process.env.TEST_MODE === 'true';

// Middleware
app.use(cors());
app.use(express.json());

// Types for job management
type AgentStage = 'define' | 'research' | 'strategy' | 'critic' | 'ceo';
type JobStatus = 'running' | 'complete' | 'error';

interface JobState {
  jobId: string;
  status: JobStatus;
  currentStage: AgentStage | null;
  completedStages: AgentStage[];
  results: Record<string, any>;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

// In-memory job storage
const jobs = new Map<string, JobState>();

// Helper to generate job ID
function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to create initial job state
function createJob(jobId: string): JobState {
  const now = Date.now();
  return {
    jobId,
    status: 'running',
    currentStage: null,
    completedStages: [],
    results: {},
    error: null,
    createdAt: now,
    updatedAt: now,
  };
}

// Helper to update job stage
function updateJobStage(jobId: string, stage: AgentStage): void {
  const job = jobs.get(jobId);
  if (job) {
    job.currentStage = stage;
    if (!job.completedStages.includes(stage)) {
      job.completedStages.push(stage);
    }
    job.updatedAt = Date.now();
  }
}

// Helper to complete job with results
function completeJob(jobId: string, results: Record<string, any>): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = 'complete';
    job.results = results;
    job.currentStage = 'ceo';
    if (!job.completedStages.includes('ceo')) {
      job.completedStages.push('ceo');
    }
    job.updatedAt = Date.now();
  }
}

// Helper to error job
function errorJob(jobId: string, error: string): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = 'error';
    job.error = error;
    job.updatedAt = Date.now();
  }
}

// Map agent names from console logs to stages
function mapAgentNameToStage(agentName: string): AgentStage | null {
  if (agentName.includes('define')) return 'define';
  if (agentName.includes('research')) return 'research';
  if (agentName.includes('strategy')) return 'strategy';
  if (agentName.includes('critic')) return 'critic';
  if (agentName.includes('ceo')) return 'ceo';
  return null;
}

// Mock pipeline for TEST_MODE - simulates 5 agents with 30-second delays each
async function runMockPipeline(jobId: string): Promise<void> {
  const agents: AgentStage[] = ['define', 'research', 'strategy', 'critic', 'ceo'];

  for (const stage of agents) {
    console.log(`[${new Date().toISOString()}] START: ${stage}-agent`);
    updateJobStage(jobId, stage);

    // Simulate agent processing time (30 seconds)
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log(`[${new Date().toISOString()}] END: ${stage}-agent`);
  }

  // Complete job with mock results
  const mockResults = {
    define_output: {
      agent: 'define-problem',
      analysis_status: 'complete',
      confidence: 78,
      neutral_restatement: 'Test product solving real market problem',
      problem_statement: 'Users waste time on mundane task X',
    },
    market_analysis_output: {
      agent: 'market-analysis',
      analysis_status: 'complete',
      tam_estimate_usd: 2500000000,
      sam_estimate_usd: 500000000,
      market_trends: ['Growing demand', 'Emerging market'],
    },
    competitor_analysis_output: {
      agent: 'competitor-analysis',
      analysis_status: 'complete',
      competitive_moat: 'Unique approach to problem',
      num_direct_competitors: 3,
      competitive_advantage: 'Speed and ease of use',
    },
    mvp_planning_output: {
      agent: 'mvp-planning',
      planning_status: 'complete',
      timeline_weeks: 8,
      estimated_cost_usd: 15000,
      core_features: ['Feature A', 'Feature B', 'Feature C'],
    },
    verification_output: {
      agent: 'verification',
      verdict: 'approve',
      trustworthiness_score: 72,
      required_revisions: [],
    },
    ceo_decision: {
      decision: 'BUILD',
      decision_confidence: 75,
      decision_status: 'approved',
      rationale: 'Strong market fit, manageable MVP scope, founder has relevant experience',
      fastest_next_action: 'Validate with 20+ prospective customers this month',
      open_risks: ['Market competition', 'Founder bandwidth', 'Pricing sensitivity'],
    },
  };

  completeJob(jobId, mockResults);
}

// POST /api/analyze - Start async job
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const idea = body.idea;
    const targetUser = body.target_user;
    const founderContext = body.founder_context;
    const priorResearch = body.prior_research;

    if (!idea || typeof idea !== 'string') {
      res.status(400).json({ error: 'idea is required and must be a string' });
      return;
    }

    // Create job
    const jobId = generateJobId();
    const job = createJob(jobId);
    jobs.set(jobId, job);

    // Return job ID immediately
    res.json({ jobId });

    // Start pipeline in background (no await)
    (async () => {
      try {
        // Use TEST_MODE mock pipeline or real orchestrator
        if (TEST_MODE) {
          console.log(`[${jobId}] Running in TEST_MODE - mocking 5-agent pipeline`);
          await runMockPipeline(jobId);
        } else {
          // Build input for Define Agent
          const inputData: DefineAgentInput = { idea: idea.trim() };
          if (typeof targetUser === 'string') {
            inputData.target_user = targetUser.trim();
          }
          if (typeof founderContext === 'string') {
            inputData.founder_context = founderContext.trim();
          }
          if (typeof priorResearch === 'string') {
            inputData.prior_research = priorResearch.trim();
          }
          const input = inputData;

          // Intercept console.log to detect agent stage transitions
          const originalLog = console.log;

          console.log = function (...args: any[]) {
            const message = args.join(' ');

            // Detect START pattern: [ISO_TIMESTAMP] START: agent-name
            const startMatch = message.match(/\] START: ([a-z-]+)/);
            if (startMatch && startMatch[1]) {
              const agentName = startMatch[1];
              const stage = mapAgentNameToStage(agentName);
              if (stage) {
                updateJobStage(jobId, stage);
              }
            }

            // Call original console.log for debugging
            originalLog.apply(console, args);
          };

          try {
            // Run orchestrator
            const orchestrator = new Orchestrator();
            const result: OrchestratorOutput = await orchestrator.run(input);

            // Restore original console.log
            console.log = originalLog;

            // Process results based on outcome
            if (result.outcome === 'decision') {
              const decision = result as OrchestratorDecisionOutput;
              const pipelineStateData = (result as unknown as Record<string, unknown>).pipeline_state || {};

              const resultData = {
                ...pipelineStateData,
                ceo_decision: {
                  decision: decision.decision,
                  decision_confidence: decision.decision_confidence,
                  decision_status: decision.decision_status,
                  rationale: decision.rationale,
                  fastest_next_action: decision.fastest_next_action,
                  open_risks: decision.open_risks,
                },
              };

              completeJob(jobId, resultData);
            } else if (result.outcome === 'halt') {
              const halt = result as OrchestratorHaltOutput;
              const errorMsg = `${halt.halt_reason}: ${halt.what_is_needed.join('. ')}`;
              console.error(`[${jobId}] Pipeline halted - ${errorMsg}`);
              errorJob(jobId, errorMsg);
            }
          } catch (error) {
            // Restore original console.log
            console.log = originalLog;

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errorJob(jobId, errorMessage);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errorJob(jobId, errorMessage);
      }
    })();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// GET /api/status/:jobId - Get job status
app.get('/api/status/:jobId', (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = jobs.get(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json(job);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`BuildScore API server running on http://localhost:${PORT}`);
  if (TEST_MODE) {
    console.log('⚠️  TEST_MODE enabled - using mock 5-agent pipeline (30s per agent)');
  }
  console.log(`POST /api/analyze - Start async job`);
  console.log(`GET /api/status/:jobId - Get job status`);
  console.log(`GET /health - Health check`);
});

// Disable timeouts for long-running jobs
server.timeout = 0;
server.keepAliveTimeout = 0;
