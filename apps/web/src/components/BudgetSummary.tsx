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
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Budget Summary</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">Total Spent</p>
          <p className="text-2xl font-bold text-gray-900">${totalCost.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Budget</p>
          <p className="text-2xl font-bold text-gray-900">${budget.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Remaining</p>
          <p className={`text-2xl font-bold ${budgetRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${budgetRemaining.toFixed(0)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Projected FPTS</p>
          <p className="text-2xl font-bold text-blue-600">{totalProjectedFpts.toFixed(1)}</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${usagePercent > 100 ? 'bg-red-500' : 'bg-blue-600'}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{usagePercent.toFixed(1)}% of budget used</p>
      </div>
    </div>
  );
}
