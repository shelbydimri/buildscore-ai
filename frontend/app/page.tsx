'use client';

import { useState } from 'react';
import { AnalyzeForm, type AnalysisInput } from '@/components/AnalyzeForm';
import { ProgressPipeline } from '@/components/ProgressPipeline';
import { ResultsDisplay } from '@/components/ResultsDisplay';

type AgentStage = 'define' | 'research' | 'strategy' | 'critic' | 'ceo';

interface StreamEvent {
  type: 'stage' | 'error' | 'complete' | 'data' | 'ping';
  stage?: AgentStage;
  message?: string;
  error?: string;
  data?: Record<string, any>;
}

export default function Home() {
  const [currentStage, setCurrentStage] = useState<AgentStage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const handleAnalyze = async (input: AnalysisInput) => {
    setIsLoading(true);
    setCurrentStage(null);
    setResults(null);
    setError(null);
    setIsComplete(false);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedResults: Record<string, any> = {};
      let receivedCompleteEvent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const event: StreamEvent = JSON.parse(line.slice(6));

            // Log each event for debugging (skip ping for brevity)
            if (event.type !== 'ping') {
              console.log('[SSE Event]', event.type, event);
            }

            // Ignore keepalive ping events
            if (event.type === 'ping') {
              continue;
            }

            if (event.type === 'stage') {
              setCurrentStage(event.stage || null);
            } else if (event.type === 'data') {
              if (event.data) {
                accumulatedResults = { ...accumulatedResults, ...event.data };
                setResults(accumulatedResults);
              }
            } else if (event.type === 'error') {
              setError(event.error || 'Unknown error occurred');
              setIsLoading(false);
              receivedCompleteEvent = true;
              return;
            } else if (event.type === 'complete') {
              setIsComplete(true);
              receivedCompleteEvent = true;
            }
          } catch (e) {
            console.error('Failed to parse event:', line, e);
          }
        }
      }

      // If stream closed without complete event, it was unexpected
      if (!receivedCompleteEvent) {
        console.error('SSE stream closed without complete event');
        setError('Connection lost during analysis. Please try again.');
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      console.error('Analysis error:', errorMessage);
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">BuildScore AI</h1>
          <p className="text-lg text-slate-600">
            Validate your startup idea with AI-powered analysis
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Get honest insights on market fit, competition, and build viability before you start coding.
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-12">
          {/* Form Section */}
          {!isLoading && !isComplete && (
            <div className="card">
              <AnalyzeForm onSubmit={handleAnalyze} isLoading={isLoading} />
            </div>
          )}

          {/* Progress Section */}
          {isLoading && (
            <div className="card">
              <ProgressPipeline
                currentStage={currentStage}
                isComplete={isComplete}
                error={error}
              />
            </div>
          )}

          {/* Results Section */}
          {isComplete && (
            <>
              <div className="card">
                <ProgressPipeline
                  currentStage={currentStage}
                  isComplete={isComplete}
                  error={error}
                />
              </div>

              <ResultsDisplay results={results} isLoading={false} />

              {/* Restart Button */}
              <div className="flex justify-center pt-8">
                <button
                  onClick={() => {
                    setIsLoading(false);
                    setCurrentStage(null);
                    setResults(null);
                    setError(null);
                    setIsComplete(false);
                  }}
                  className="btn-primary"
                >
                  Analyze Another Idea
                </button>
              </div>
            </>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <>
              <div className="card">
                <ProgressPipeline
                  currentStage={currentStage}
                  isComplete={isComplete}
                  error={error}
                />
              </div>

              <div className="flex justify-center pt-8">
                <button
                  onClick={() => {
                    setIsLoading(false);
                    setCurrentStage(null);
                    setResults(null);
                    setError(null);
                    setIsComplete(false);
                  }}
                  className="btn-primary"
                >
                  Try Again
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 pt-8 border-t border-slate-200 text-center text-sm text-slate-500">
        <p>
          BuildScore AI © 2026 | Powered by Claude AI and advanced startup validation techniques
        </p>
      </footer>
    </main>
  );
}
