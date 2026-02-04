import type { RosterPlayer } from '../../lib/types';

interface MyRosterProps {
  roster: RosterPlayer[];
  slotsNeeded: string[];
  onUndo: () => void;
}

export function MyRoster({ roster, slotsNeeded, onUndo }: MyRosterProps) {
  const totalCost = roster.reduce((sum, p) => sum + p.cost, 0);
  const totalFpts = roster.reduce((sum, p) => sum + p.projected_fpts, 0);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">My Roster</h3>
        <button
          onClick={onUndo}
          disabled={roster.length === 0}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Undo
        </button>
      </div>

      <div className="space-y-2">
        {/* Show drafted players */}
        {roster.map((player) => (
          <div
            key={player.player_id}
            className="flex justify-between items-center p-2 bg-blue-50 rounded"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-blue-200 px-2 py-0.5 rounded">
                {player.slot}
              </span>
              <span className="font-medium">{player.name}</span>
              <span className="text-gray-500 text-sm">{player.team}</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-green-600">${player.cost}</span>
              <span className="text-gray-500 text-sm ml-2">
                {player.projected_fpts.toFixed(1)} FPTS
              </span>
            </div>
          </div>
        ))}

        {/* Show empty slots */}
        {slotsNeeded.map((slot, idx) => (
          <div
            key={`empty-${slot}-${idx}`}
            className="flex justify-between items-center p-2 bg-gray-50 rounded border-2 border-dashed border-gray-200"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-gray-200 px-2 py-0.5 rounded">
                {slot}
              </span>
              <span className="text-gray-400 italic">Empty</span>
            </div>
          </div>
        ))}
      </div>

      {/* Roster totals */}
      {roster.length > 0 && (
        <div className="mt-4 pt-3 border-t flex justify-between text-sm">
          <span className="text-gray-600">Total: {roster.length} players</span>
          <div className="space-x-4">
            <span className="font-semibold">${totalCost}</span>
            <span className="text-gray-600">{totalFpts.toFixed(1)} FPTS</span>
          </div>
        </div>
      )}
    </div>
  );
}
