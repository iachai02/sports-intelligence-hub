interface BudgetTrackerProps {
  remaining: number;
  total: number;
  spotsRemaining: number;
}

export function BudgetTracker({ remaining, total, spotsRemaining }: BudgetTrackerProps) {
  const spent = total - remaining;
  const percentSpent = (spent / total) * 100;
  const avgPerSpot = spotsRemaining > 0 ? remaining / spotsRemaining : 0;

  // Color coding based on budget health
  const getStatusColor = () => {
    if (avgPerSpot < 5 && spotsRemaining > 3) return 'text-stat-negative';
    if (avgPerSpot < 10 && spotsRemaining > 5) return 'text-yellow-500';
    return 'text-stat-positive';
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-3 text-foreground">Budget</h3>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-4 mb-3">
        <div
          className="bg-accent h-4 rounded-full transition-all"
          style={{ width: `${Math.min(percentSpent, 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Remaining</span>
          <p className={`text-2xl font-bold ${getStatusColor()}`}>${remaining}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Spent</span>
          <p className="text-2xl font-bold text-foreground">${spent}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Spots Left</span>
          <p className="text-lg font-semibold text-foreground">{spotsRemaining}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Avg/Spot</span>
          <p className={`text-lg font-semibold ${getStatusColor()}`}>
            ${avgPerSpot.toFixed(0)}
          </p>
        </div>
      </div>
    </div>
  );
}
