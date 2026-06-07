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
  const encoder = new TextEncoder();

  try {
    const body = await request.json();
    const { idea, target_user, founder_context, prior_research } = body;

    if (!idea) {
      return new NextResponse(
        encodeSSE({ type: 'error', error: 'Idea is required' }) +
        encodeSSE({ type: 'complete' }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Call backend /api/analyze to start job
    const backendUrl = `${BACKEND_URL}/api/analyze`;
    const startResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idea,
        target_user,
        founder_context,
        prior_research,
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout to get jobId
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      return new NextResponse(
        encodeSSE({
          type: 'error',
          error: `Failed to start job: ${startResponse.statusText}. ${errorText}`,
        }) + encodeSSE({ type: 'complete' }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const startData = (await startResponse.json()) as { jobId: string };
    const jobId = startData.jobId;

    // Stream polling results back to client
    const stream = new ReadableStream({
      async start(controller) {
        let lastCompletedStages: string[] = [];
        let isComplete = false;
        let hasError = false;

        try {
          // Poll every 5 seconds until complete
          while (!isComplete && !hasError) {
            // Wait 5 seconds before polling
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Get job status
            const statusUrl = `${BACKEND_URL}/api/status/${jobId}`;
            const statusResponse = await fetch(statusUrl, {
              method: 'GET',
              signal: AbortSignal.timeout(5000), // 5s timeout for status check
            });

            if (!statusResponse.ok) {
              const errorText = await statusResponse.text();
              controller.enqueue(
                encoder.encode(
                  encodeSSE({
                    type: 'error',
                    error: `Failed to get job status: ${statusResponse.statusText}. ${errorText}`,
                  }) + encodeSSE({ type: 'complete' })
                )
              );
              hasError = true;
              break;
            }

            const jobState = (await statusResponse.json()) as {
              status: 'running' | 'complete' | 'error';
              currentStage: AgentStage | null;
              completedStages: AgentStage[];
              results: Record<string, any>;
              error: string | null;
            };

            // Emit stage events for newly completed stages
            for (const stage of jobState.completedStages) {
              if (!lastCompletedStages.includes(stage)) {
                controller.enqueue(
                  encoder.encode(encodeSSE({ type: 'stage', stage }))
                );
                lastCompletedStages.push(stage);
              }
            }

            // Check if job is complete
            if (jobState.status === 'complete') {
              // Emit final results
              controller.enqueue(
                encoder.encode(
                  encodeSSE({
                    type: 'data',
                    data: jobState.results,
                  })
                )
              );
              controller.enqueue(
                encoder.encode(encodeSSE({ type: 'complete' }))
              );
              isComplete = true;
            } else if (jobState.status === 'error') {
              // Emit error
              controller.enqueue(
                encoder.encode(
                  encodeSSE({
                    type: 'error',
                    error: jobState.error || 'Unknown error',
                  }) + encodeSSE({ type: 'complete' })
                )
              );
              hasError = true;
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Stream error';
          console.error('Polling error:', errorMessage);
          controller.enqueue(
            encoder.encode(
              encodeSSE({
                type: 'error',
                error: `Polling error: ${errorMessage}`,
              }) + encodeSSE({ type: 'complete' })
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('API error:', errorMessage);

    return new NextResponse(
      encodeSSE({ type: 'error', error: errorMessage }) +
      encodeSSE({ type: 'complete' }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
