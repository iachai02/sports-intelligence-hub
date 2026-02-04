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
    if (avgPerSpot < 5 && spotsRemaining > 3) return 'text-red-600';
    if (avgPerSpot < 10 && spotsRemaining > 5) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-3">Budget</h3>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
        <div
          className="bg-blue-600 h-4 rounded-full transition-all"
          style={{ width: `${Math.min(percentSpent, 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Remaining</span>
          <p className={`text-2xl font-bold ${getStatusColor()}`}>${remaining}</p>
        </div>
        <div>
          <span className="text-gray-500">Spent</span>
          <p className="text-2xl font-bold text-gray-800">${spent}</p>
        </div>
        <div>
          <span className="text-gray-500">Spots Left</span>
          <p className="text-lg font-semibold">{spotsRemaining}</p>
        </div>
        <div>
          <span className="text-gray-500">Avg/Spot</span>
          <p className={`text-lg font-semibold ${getStatusColor()}`}>
            ${avgPerSpot.toFixed(0)}
          </p>
        </div>
      </div>
    </div>
  );
}
