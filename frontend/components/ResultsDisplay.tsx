'use client';

interface ResultsDisplayProps {
  results: Record<string, any> | null;
  isLoading: boolean;
}

export function ResultsDisplay({ results, isLoading }: ResultsDisplayProps) {
  if (isLoading || !results) {
    return null;
  }

  const buildScore = results?.ceo_agent?.build_score || null;
  const decision = results?.ceo_agent?.recommendation || null;
  const confidence = results?.define_agent?.confidence || 0;
  const risks = results?.critic_agent?.risks || [];
  const nextSteps = results?.ceo_agent?.recommended_next_steps || [];

  return (
    <div className="space-y-8">
      {/* Build Decision Card */}
      {decision && (
        <div className="card">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Build Decision</h2>
            <div
              className={`
                inline-block px-4 py-2 rounded-lg font-semibold text-lg
                ${
                  decision === 'build'
                    ? 'bg-green-100 text-green-800'
                    : decision === 'pivot'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                }
              `}
            >
              {decision.toUpperCase()}
            </div>
          </div>

          {/* Build Score */}
          {buildScore !== null && (
            <div className="mb-6">
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">
                    BuildScore
                  </p>
                  <p className="text-4xl font-bold text-blue-600">{buildScore}</p>
                  <p className="text-sm text-slate-500 mt-1">out of 100</p>
                </div>
                <div className="flex-1">
                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        buildScore >= 70
                          ? 'bg-green-500'
                          : buildScore >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${buildScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confidence */}
          {confidence > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-600 mb-2">
                Analysis Confidence
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-200 rounded-full h-2">
                  <div
                    className="h-2 bg-blue-500 rounded-full"
                    style={{ width: `${confidence}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-700 min-w-fit">
                  {confidence}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Problem Definition */}
      {results?.define_agent?.problem_statement && (
        <div className="card">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Problem Definition</h3>
          <p className="text-slate-700 leading-relaxed">
            {results.define_agent.problem_statement}
          </p>
          {results.define_agent.why_now && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm font-medium text-slate-600 mb-2">Why Now</p>
              <p className="text-slate-700">{results.define_agent.why_now}</p>
            </div>
          )}
        </div>
      )}

      {/* Market Research */}
      {results?.research_agent && (
        <div className="card">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Market Research</h3>
          <div className="grid gap-6">
            {results.research_agent.market_analysis && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Market Analysis</h4>
                <p className="text-slate-700">
                  {results.research_agent.market_analysis.summary ||
                    'Market analysis in progress...'}
                </p>
              </div>
            )}
            {results.research_agent.competitor_analysis && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">
                  Competitive Landscape
                </h4>
                <p className="text-slate-700">
                  {results.research_agent.competitor_analysis.summary ||
                    'Competitive analysis in progress...'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Strategy */}
      {results?.strategy_agent && (
        <div className="card">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Go-to-Market Strategy</h3>
          <div className="space-y-4">
            {results.strategy_agent.strategy_recommendation && (
              <p className="text-slate-700">
                {results.strategy_agent.strategy_recommendation}
              </p>
            )}
            {results.strategy_agent.mvp_plan && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm font-medium text-slate-600 mb-2">MVP Plan</p>
                <p className="text-slate-700">
                  {results.strategy_agent.mvp_plan}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key Risks */}
      {risks.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Key Risks & Caveats</h3>
          <div className="space-y-3">
            {risks.map((risk: any, idx: number) => (
              <div key={idx} className="flex gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <span className="text-red-600 font-bold flex-shrink-0">⚠</span>
                <div>
                  <p className="font-semibold text-red-900 text-sm">{risk.type}</p>
                  <p className="text-red-700 text-sm">{risk.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Next Actions */}
      {nextSteps.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Recommended Next Steps</h3>
          <div className="space-y-3">
            {nextSteps.map((step: any, idx: number) => (
              <div key={idx} className="flex gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-200 text-blue-900 font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{step.action}</p>
                  <p className="text-sm text-slate-600 mt-1">{step.expected_signal}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw JSON */}
      {results && (
        <div className="card">
          <details className="group">
            <summary className="cursor-pointer font-semibold text-slate-900 hover:text-blue-600">
              Full Analysis JSON
            </summary>
            <div className="mt-4 p-4 bg-slate-900 rounded-lg overflow-x-auto">
              <pre className="text-xs text-slate-100 font-mono">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
