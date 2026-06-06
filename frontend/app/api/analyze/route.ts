import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

type AgentStage = 'define' | 'research' | 'strategy' | 'critic' | 'ceo';

interface StreamEvent {
  type: 'stage' | 'error' | 'complete' | 'data';
  stage?: AgentStage;
  error?: string;
  data?: Record<string, any>;
}

function encodeSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idea, target_user, founder_context, prior_research } = body;

    if (!idea) {
      return NextResponse.json(
        { error: 'Idea is required' },
        { status: 400 }
      );
    }

    // Create a custom readable stream that simulates progress events
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Emit stage: define
          controller.enqueue(
            encoder.encode(encodeSSE({ type: 'stage', stage: 'define' }))
          );

          // Call backend API to run analysis
          // For now, we'll simulate the backend call
          const analysisInput = {
            idea,
            target_user,
            founder_context,
            prior_research,
          };

          // Simulate backend processing with events
          await new Promise((resolve) => setTimeout(resolve, 1000));
          controller.enqueue(
            encoder.encode(
              encodeSSE({
                type: 'data',
                data: { define_agent: { confidence: 45, problem_statement: 'Validating...' } },
              })
            )
          );

          controller.enqueue(
            encoder.encode(encodeSSE({ type: 'stage', stage: 'research' }))
          );
          await new Promise((resolve) => setTimeout(resolve, 1500));
          controller.enqueue(
            encoder.encode(
              encodeSSE({
                type: 'data',
                data: { research_agent: { summary: 'Market research in progress...' } },
              })
            )
          );

          controller.enqueue(
            encoder.encode(encodeSSE({ type: 'stage', stage: 'strategy' }))
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          controller.enqueue(
            encoder.encode(
              encodeSSE({
                type: 'data',
                data: { strategy_agent: { recommendation: 'Strategy developing...' } },
              })
            )
          );

          controller.enqueue(
            encoder.encode(encodeSSE({ type: 'stage', stage: 'critic' }))
          );
          await new Promise((resolve) => setTimeout(resolve, 1200));
          controller.enqueue(
            encoder.encode(
              encodeSSE({
                type: 'data',
                data: { critic_agent: { risks: [] } },
              })
            )
          );

          controller.enqueue(
            encoder.encode(encodeSSE({ type: 'stage', stage: 'ceo' }))
          );
          await new Promise((resolve) => setTimeout(resolve, 800));
          controller.enqueue(
            encoder.encode(
              encodeSSE({
                type: 'data',
                data: { ceo_agent: { build_score: 72, recommendation: 'build' } },
              })
            )
          );

          controller.enqueue(
            encoder.encode(encodeSSE({ type: 'complete' }))
          );

          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(
            encoder.encode(encodeSSE({ type: 'error', error: errorMessage }))
          );
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
