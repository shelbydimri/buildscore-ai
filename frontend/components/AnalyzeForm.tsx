'use client';

import { FormEvent, useState } from 'react';

interface AnalyzeFormProps {
  onSubmit: (data: AnalysisInput) => void;
  isLoading: boolean;
}

export interface AnalysisInput {
  idea: string;
  target_user?: string;
  founder_context?: string;
  prior_research?: string;
}

export function AnalyzeForm({ onSubmit, isLoading }: AnalyzeFormProps) {
  const [idea, setIdea] = useState('');
  const [targetUser, setTargetUser] = useState('');
  const [founderContext, setFounderContext] = useState('');
  const [priorResearch, setPriorResearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!idea.trim()) {
      setErrors({ idea: 'Startup idea is required' });
      return;
    }

    if (idea.trim().length < 10) {
      setErrors({ idea: 'Please provide at least 10 characters' });
      return;
    }

    onSubmit({
      idea: idea.trim(),
      target_user: targetUser.trim() || undefined,
      founder_context: founderContext.trim() || undefined,
      prior_research: priorResearch.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Idea Textarea */}
      <div>
        <label htmlFor="idea" className="block text-sm font-semibold text-slate-900 mb-2">
          Your Startup Idea
          <span className="text-red-500">*</span>
        </label>
        <textarea
          id="idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Describe your startup idea. The more context, the better. e.g., 'AI tool that helps solo founders validate startup ideas before building by analyzing market size, competitive landscape, and user willingness to pay.'"
          rows={5}
          className={`input-field resize-none ${errors.idea ? 'border-red-500 ring-red-500' : ''}`}
          disabled={isLoading}
        />
        {errors.idea && <p className="mt-1 text-sm text-red-600">{errors.idea}</p>}
        <p className="mt-1 text-xs text-slate-500">
          Character count: {idea.length}
        </p>
      </div>

      {/* Optional Fields */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Target User */}
        <div>
          <label htmlFor="targetUser" className="block text-sm font-semibold text-slate-900 mb-2">
            Target User (Optional)
          </label>
          <input
            id="targetUser"
            type="text"
            value={targetUser}
            onChange={(e) => setTargetUser(e.target.value)}
            placeholder="e.g., First-time founders, indie hackers, bootstrapped startups"
            className="input-field"
            disabled={isLoading}
          />
        </div>

        {/* Founder Context */}
        <div>
          <label htmlFor="founderContext" className="block text-sm font-semibold text-slate-900 mb-2">
            Founder Context (Optional)
          </label>
          <input
            id="founderContext"
            type="text"
            value={founderContext}
            onChange={(e) => setFounderContext(e.target.value)}
            placeholder="e.g., Former product manager, 5 years of SaaS experience"
            className="input-field"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Prior Research */}
      <div>
        <label htmlFor="priorResearch" className="block text-sm font-semibold text-slate-900 mb-2">
          Prior Research (Optional)
        </label>
        <textarea
          id="priorResearch"
          value={priorResearch}
          onChange={(e) => setPriorResearch(e.target.value)}
          placeholder="Any market research, user interviews, or validation data you've already done"
          rows={3}
          className="input-field resize-none"
          disabled={isLoading}
        />
      </div>

      {/* Submit Button */}
      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary flex-1"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Analyzing...
            </span>
          ) : (
            'Analyze My Idea'
          )}
        </button>

        {isLoading && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => window.location.reload()}
          >
            Cancel
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 text-center">
        Analysis typically takes 3–6 minutes. We&apos;ll use advanced AI agents to validate your idea against market data, competitive landscape, and user demand signals.
      </p>
    </form>
  );
}
