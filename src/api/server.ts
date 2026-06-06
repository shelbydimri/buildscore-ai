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

// Middleware
app.use(cors());
app.use(express.json());

// Type for SSE events
type AgentStage = 'define' | 'research' | 'strategy' | 'critic' | 'ceo';
type EventType = 'stage' | 'error' | 'complete' | 'data';

interface SSEEvent {
  type: EventType;
  stage?: AgentStage;
  error?: string;
  data?: Record<string, any>;
}

// Helper to encode SSE events
function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// Map agent names from console logs to stages
function mapAgentNameToStage(agentName: string): AgentStage | null {
  if (agentName.includes('define')) {
    return 'define';
  }
  if (agentName.includes('research')) {
    return 'research';
  }
  if (agentName.includes('strategy')) {
    return 'strategy';
  }
  if (agentName.includes('critic')) {
    return 'critic';
  }
  if (agentName.includes('ceo')) {
    return 'ceo';
  }
  return null;
}

// POST /api/analyze - Stream analysis with SSE
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

    // Set up SSE response headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

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

    // Track which stages we've emitted events for
    const emittedStages = new Set<AgentStage>();

    // Intercept console.log to detect agent stage transitions
    const originalLog = console.log;

    console.log = function (...args: any[]) {
      const message = args.join(' ');

      // Detect START/END patterns: [ISO_TIMESTAMP] START: agent-name
      const startMatch = message.match(/\] START: ([a-z-]+)/);
      if (startMatch && startMatch[1]) {
        const agentName = startMatch[1];
        const stage = mapAgentNameToStage(agentName);
        if (stage && !emittedStages.has(stage)) {
          emittedStages.add(stage);
          res.write(encodeSSE({ type: 'stage', stage }));
        }
      }

      // Call original console.log for debugging (if needed, suppress in production)
      originalLog.apply(console, args);
    };

    try {
      // Run orchestrator
      const orchestrator = new Orchestrator();
      const result: OrchestratorOutput = await orchestrator.run(input);

      // Restore original console.log
      console.log = originalLog;

      // Emit data events based on result type
      if (result.outcome === 'decision') {
        const decision = result as OrchestratorDecisionOutput;

        // Emit full pipeline state with CEO decision
        const pipelineStateData = (result as unknown as Record<string, unknown>).pipeline_state || {};
        res.write(
          encodeSSE({
            type: 'data',
            data: {
              ...pipelineStateData,
              ceo_decision: {
                decision: decision.decision,
                decision_confidence: decision.decision_confidence,
                decision_status: decision.decision_status,
                rationale: decision.rationale,
                fastest_next_action: decision.fastest_next_action,
                open_risks: decision.open_risks,
              },
            },
          })
        );
      } else if (result.outcome === 'halt') {
        const halt = result as OrchestratorHaltOutput;
        // Emit partial state
        res.write(
          encodeSSE({
            type: 'data',
            data: halt.partial_state,
          })
        );

        // Emit error
        res.write(
          encodeSSE({
            type: 'error',
            error: `${halt.halt_reason}: ${halt.what_is_needed.join('. ')}`,
          })
        );
      }

      // Emit completion event
      res.write(encodeSSE({ type: 'complete' }));
      res.end();
    } catch (error) {
      // Restore original console.log
      console.log = originalLog;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.write(encodeSSE({ type: 'error', error: errorMessage }));
      res.end();
    }
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
app.listen(PORT, () => {
  console.log(`BuildScore API server running on http://localhost:${PORT}`);
  console.log(`POST /api/analyze - Stream startup analysis`);
  console.log(`GET /health - Health check`);
});
