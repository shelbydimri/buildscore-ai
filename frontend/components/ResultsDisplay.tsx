'use client';

import { useState } from 'react';

interface ResultsDisplayProps {
  results: Record<string, any> | null;
  isLoading: boolean;
}

export function ResultsDisplay({ results, isLoading }: ResultsDisplayProps) {
  const [showRawJson, setShowRawJson] = useState(false);

  if (isLoading || !results) {
    return null;
  }

  // Extract CEO decision from results
  const ceoDecision = results.ceo_decision || results.startup_validation_output || {};
  const decision = ceoDecision.decision || 'UNKNOWN';
  const confidence = ceoDecision.decision_confidence || 0;
  const rationale = ceoDecision.decision_rationale || {};
  const risks = ceoDecision.open_risks || [];
  const nextAction = ceoDecision.fastest_next_action || {};
  const primaryFactors = rationale.primary_factors || [];
  const counterargument = rationale.strongest_counterargument || '';

  // Determine decision color
  const getDecisionColor = (decision: string) => {
    if (decision === 'PROCEED') {
      return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', banner: 'bg-green-100 text-green-800' };
    } else if (decision === 'PROCEED WITH CAUTION') {
      return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900', banner: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', banner: 'bg-red-100 text-red-800' };
    }
  };

  const colors = getDecisionColor(decision);

  return (
    <div className="space-y-8">
      {/* Decision Banner */}
      <div className={`card ${colors.bg} border-2 ${colors.border}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Build Decision</h2>
            <div
              className={`
                inline-block px-6 py-3 rounded-lg font-bold text-xl
                ${colors.banner}
              `}
            >
              {decision}
            </div>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">Decision Confidence</p>
            <p className="text-lg font-bold text-slate-900">{confidence}%</p>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                confidence >= 75
                  ? 'bg-green-500'
                  : confidence >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        {/* Counterargument */}
        {counterargument && (
          <div className="mt-4 p-4 bg-slate-100 rounded-lg border border-slate-300">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Strongest Counterargument</p>
            <p className="text-slate-700 text-sm">{counterargument}</p>
          </div>
        )}
      </div>

      {/* Primary Factors */}
      {primaryFactors.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Key Decision Factors</h3>
          <div className="space-y-3">
            {primaryFactors.map((factor: any, idx: number) => {
              const isSupporting = factor.direction === 'supports';
              return (
                <div
                  key={idx}
                  className={`flex gap-4 p-4 rounded-lg border ${
                    isSupporting
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <span className={`flex-shrink-0 font-bold text-xl ${isSupporting ? 'text-green-600' : 'text-red-600'}`}>
                    {isSupporting ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <p className={`font-semibold ${isSupporting ? 'text-green-900' : 'text-red-900'}`}>
                      {factor.factor}
                    </p>
                    <p className={`text-sm mt-1 ${isSupporting ? 'text-green-700' : 'text-red-700'}`}>
                      {isSupporting ? 'Supports' : 'Opposes'} the decision
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fastest Next Action */}
      {nextAction.action && (
        <div className="card bg-blue-50 border-2 border-blue-200">
          <div className="mb-2">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Next Action</p>
            <h3 className="text-xl font-bold text-blue-900 mt-2">{nextAction.action}</h3>
          </div>
          {nextAction.expected_learning && (
            <p className="text-blue-700 mt-3">
              <span className="font-semibold">Expected learning:</span> {nextAction.expected_learning}
            </p>
          )}
          {nextAction.effort && (
            <p className="text-sm text-blue-600 mt-2">
              <span className="font-semibold">Effort:</span> {nextAction.effort}
            </p>
          )}
        </div>
      )}

      {/* Open Risks */}
      {risks.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Open Risks</h3>
          <div className="space-y-3">
            {risks.map((risk: any, idx: number) => (
              <div key={idx} className="flex gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-amber-600 font-bold flex-shrink-0 text-lg">⚠</span>
                <div className="flex-1">
                  <p className="font-semibold text-amber-900">{risk.risk}</p>
                  <p className="text-amber-700 text-sm mt-1">
                    <span className="font-semibold">Severity:</span> {risk.severity}
                  </p>
                  {risk.mitigation_status && (
                    <p className="text-amber-700 text-sm mt-1">
                      <span className="font-semibold">Status:</span> {risk.mitigation_status}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw JSON (Collapsed) */}
      {results && (
        <div className="card">
          <details className="group">
            <summary
              className="cursor-pointer font-semibold text-slate-900 hover:text-blue-600 flex items-center gap-2 select-none"
              onClick={() => setShowRawJson(!showRawJson)}
            >
              <span className={`transform transition-transform ${showRawJson ? 'rotate-90' : ''}`}>
                ▶
              </span>
              Full Analysis JSON (Developer View)
            </summary>
            {showRawJson && (
              <div className="mt-4 p-4 bg-slate-900 rounded-lg overflow-x-auto max-h-96">
                <pre className="text-xs text-slate-100 font-mono">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </div>
            )}
          </details>
        </div>
      )}
    </div>
  );
}
