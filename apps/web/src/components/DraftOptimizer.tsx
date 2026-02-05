import { useState } from 'react';
import type { OptimizeResponse } from '../lib/types';
import { optimizeRoster } from '../lib/api';
import { OptimizeButton } from './OptimizeButton';
import { BudgetSummary } from './BudgetSummary';
import { RosterTable } from './RosterTable';

export function DraftOptimizer() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizeResponse | null>(null);

  const handleOptimize = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await optimizeRoster({ use_mock_data: true });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to optimize roster');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Fantasy Draft Optimizer</h1>
        <p className="text-muted-foreground">Optimize your fantasy basketball auction draft roster</p>
      </div>

      <div className="flex justify-center">
        <OptimizeButton onClick={handleOptimize} loading={loading} />
      </div>

      {error && (
        <div className="bg-stat-negative/10 border border-stat-negative/20 rounded-lg p-4">
          <p className="text-stat-negative">{error}</p>
        </div>
      )}

      {result && (
        <>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                result.status === 'Optimal'
                  ? 'bg-stat-positive/20 text-stat-positive'
                  : 'bg-yellow-500/20 text-yellow-500'
              }`}
            >
              {result.status}
            </span>
          </div>

          <BudgetSummary
            totalCost={result.total_cost}
            budget={result.budget}
            budgetRemaining={result.budget_remaining}
            totalProjectedFpts={result.total_projected_fpts}
          />

          <RosterTable roster={result.roster} rosterSize={result.roster_size} />
        </>
      )}
    </div>
  );
}
