interface BudgetSummaryProps {
  totalCost: number;
  budget: number;
  budgetRemaining: number;
  totalProjectedFpts: number;
}

export function BudgetSummary({
  totalCost,
  budget,
  budgetRemaining,
  totalProjectedFpts,
}: BudgetSummaryProps) {
  const usagePercent = (totalCost / budget) * 100;

  return (
    <div className="bg-card border border-border rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4 text-foreground">Budget Summary</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Total Spent</p>
          <p className="text-2xl font-bold text-foreground">${totalCost.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Budget</p>
          <p className="text-2xl font-bold text-foreground">${budget.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Remaining</p>
          <p className={`text-2xl font-bold ${budgetRemaining >= 0 ? 'text-stat-positive' : 'text-stat-negative'}`}>
            ${budgetRemaining.toFixed(0)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Projected FPTS</p>
          <p className="text-2xl font-bold text-accent">{totalProjectedFpts.toFixed(1)}</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${usagePercent > 100 ? 'bg-stat-negative' : 'bg-accent'}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{usagePercent.toFixed(1)}% of budget used</p>
      </div>
    </div>
  );
}
