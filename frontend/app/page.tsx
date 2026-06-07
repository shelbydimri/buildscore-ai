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

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

    try {
      // Step 1: Start the job
      console.log('[Browser] Submitting to:', `${backendUrl}/api/analyze`);
      const startResponse = await fetch(`${backendUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!startResponse.ok) {
        throw new Error(`Failed to start job: ${startResponse.statusText}`);
      }

      const startData = (await startResponse.json()) as { jobId: string };
      const jobId = startData.jobId;
      console.log('[Browser] Job started:', jobId);

      let accumulatedResults: Record<string, any> = {};
      let lastCompletedStages: string[] = [];

      // Step 2: Poll for status every 6 seconds
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`${backendUrl}/api/status/${jobId}`, {
            method: 'GET',
          });

          if (!statusResponse.ok) {
            throw new Error(`Failed to get status: ${statusResponse.statusText}`);
          }

          const jobState = (await statusResponse.json()) as {
            status: 'running' | 'complete' | 'error';
            currentStage: AgentStage | null;
            completedStages: AgentStage[];
            results: Record<string, any>;
            error: string | null;
          };

          console.log('[Browser] Poll result:', jobState.status, jobState.currentStage);

          // Emit stage events for newly completed stages
          for (const stage of jobState.completedStages) {
            if (!lastCompletedStages.includes(stage)) {
              console.log('[Browser] Stage completed:', stage);
              setCurrentStage(stage);
              lastCompletedStages.push(stage);
            }
          }

          // Handle completion
          if (jobState.status === 'complete') {
            console.log('[Browser] Job complete');
            accumulatedResults = { ...accumulatedResults, ...jobState.results };
            setResults(accumulatedResults);
            setIsComplete(true);
            setIsLoading(false);
            clearInterval(pollInterval);
          } else if (jobState.status === 'error') {
            console.log('[Browser] Job error:', jobState.error);
            setError(jobState.error || 'Unknown error occurred');
            setIsLoading(false);
            clearInterval(pollInterval);
          }
        } catch (pollError) {
          const errorMessage = pollError instanceof Error ? pollError.message : 'Poll failed';
          console.error('[Browser] Polling error:', errorMessage);
          setError(errorMessage);
          setIsLoading(false);
          clearInterval(pollInterval);
        }
      }, 6000); // Poll every 6 seconds
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      console.error('[Browser] Analysis error:', errorMessage);
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
