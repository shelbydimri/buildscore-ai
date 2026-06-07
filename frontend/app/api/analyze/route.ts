import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_URL || 'http://localhost:3000';

type AgentStage = 'define' | 'research' | 'strategy' | 'critic' | 'ceo';

interface StreamEvent {
  type: 'stage' | 'error' | 'complete' | 'data' | 'ping';
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

    // Call backend API with extended timeout and keepalive
    const backendUrl = `${BACKEND_URL}/api/analyze`;

    const backendResponse = await fetch(backendUrl, {
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
      signal: AbortSignal.timeout(420000), // 7 minutes timeout for full pipeline
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return new NextResponse(
        encodeSSE({
          type: 'error',
          error: `Backend error (${backendResponse.status}): ${backendResponse.statusText}. ${errorText}`,
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

    if (!backendResponse.body) {
      return new NextResponse(
        encodeSSE({ type: 'error', error: 'No response body from backend' }) +
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

    // Stream the response directly from backend to client with error handling and keepalive
    const stream = new ReadableStream({
      async start(controller) {
        // Keepalive ping every 20 seconds to prevent Render 30s timeout
        const pingInterval = setInterval(() => {
          controller.enqueue(encoder.encode(encodeSSE({ type: 'ping' })));
        }, 20000);

        try {
          const reader = backendResponse.body!.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(encoder.encode(chunk));
          }

          // Ensure stream ends properly
          const finalChunk = decoder.decode();
          if (finalChunk) {
            controller.enqueue(encoder.encode(finalChunk));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Stream error';
          console.error('Stream error:', errorMessage);
          controller.enqueue(
            encoder.encode(
              encodeSSE({ type: 'error', error: `Connection lost: ${errorMessage}` }) +
              encodeSSE({ type: 'complete' })
            )
          );
        } finally {
          clearInterval(pingInterval);
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
