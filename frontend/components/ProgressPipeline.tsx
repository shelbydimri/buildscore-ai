'use client';

import { useMemo } from 'react';

type AgentStage = 'define' | 'research' | 'strategy' | 'critic' | 'ceo';

interface ProgressPipelineProps {
  currentStage: AgentStage | null;
  isComplete: boolean;
  error?: string | null;
}

const STAGES: { id: AgentStage; label: string; description: string }[] = [
  { id: 'define', label: 'Define', description: 'Extract the problem' },
  { id: 'research', label: 'Research', description: 'Market & competitors' },
  { id: 'strategy', label: 'Strategy', description: 'Build approach' },
  { id: 'critic', label: 'Critic', description: 'Review & refine' },
  { id: 'ceo', label: 'CEO', description: 'Final decision' },
];

const STAGE_ORDER: AgentStage[] = ['define', 'research', 'strategy', 'critic', 'ceo'];

export function ProgressPipeline({
  currentStage,
  isComplete,
  error,
}: ProgressPipelineProps) {
  const stageStatus = useMemo(() => {
    if (!currentStage) {
      return STAGES.map((s) => ({ ...s, status: 'pending' as const }));
    }

    const currentIndex = STAGE_ORDER.indexOf(currentStage);

    return STAGES.map((stage) => {
      const stageIndex = STAGE_ORDER.indexOf(stage.id);

      if (stageIndex < currentIndex) {
        return { ...stage, status: 'complete' as const };
      } else if (stageIndex === currentIndex) {
        return { ...stage, status: 'active' as const };
      } else {
        return { ...stage, status: 'pending' as const };
      }
    });
  }, [currentStage]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 mb-8">
        {stageStatus.map((stage, index) => (
          <div key={stage.id} className="flex items-center flex-1">
            {/* Stage Circle */}
            <div
              className={`
                relative w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm
                transition-all duration-300 flex-shrink-0
                ${
                  stage.status === 'complete'
                    ? 'bg-green-500 text-white'
                    : stage.status === 'active'
                      ? 'bg-blue-500 text-white animate-pulse'
                      : 'bg-slate-200 text-slate-600'
                }
              `}
            >
              {stage.status === 'complete' ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span>{index + 1}</span>
              )}
            </div>

            {/* Connecting Line */}
            {index < STAGES.length - 1 && (
              <div
                className={`
                  h-1 flex-1 mx-2 transition-all duration-300 rounded-full
                  ${stage.status === 'complete' ? 'bg-green-500' : 'bg-slate-300'}
                `}
              />
            )}
          </div>
        ))}
      </div>

      {/* Stage Labels and Descriptions */}
      <div className="grid grid-cols-5 gap-2 text-center mb-4">
        {stageStatus.map((stage) => (
          <div key={stage.id} className="min-w-0">
            <p
              className={`
                font-semibold text-sm truncate
                ${
                  stage.status === 'active'
                    ? 'text-blue-600'
                    : stage.status === 'complete'
                      ? 'text-green-600'
                      : 'text-slate-500'
                }
              `}
            >
              {stage.label}
            </p>
            <p className="text-xs text-slate-500 truncate">{stage.description}</p>
          </div>
        ))}
      </div>

      {/* Status Message */}
      <div className="mt-6">
        {error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-800">Analysis Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        ) : isComplete ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800">Analysis Complete</p>
            <p className="text-sm text-green-700 mt-1">
              Scroll down to view your BuildScore report.
            </p>
          </div>
        ) : currentStage ? (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800">
              Analyzing with {STAGES.find((s) => s.id === currentStage)?.label} Agent
            </p>
            <p className="text-sm text-blue-700 mt-1">
              This typically takes 3–6 minutes. Please wait...
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
