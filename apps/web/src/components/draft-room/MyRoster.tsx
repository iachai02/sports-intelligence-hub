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
    <div className="bg-card border border-border rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-foreground">My Roster</h3>
        <button
          onClick={onUndo}
          disabled={roster.length === 0}
          className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded disabled:opacity-50 disabled:cursor-not-allowed text-foreground transition-colors"
        >
          Undo
        </button>
      </div>

      <div className="space-y-2">
        {/* Show drafted players */}
        {roster.map((player) => (
          <div
            key={player.player_id}
            className="flex justify-between items-center p-2 bg-accent/10 rounded"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-accent/20 text-accent px-2 py-0.5 rounded">
                {player.slot}
              </span>
              <span className="font-medium text-foreground">{player.name}</span>
              <span className="text-muted-foreground text-sm">{player.team}</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-stat-positive">${player.cost}</span>
              <span className="text-muted-foreground text-sm ml-2">
                {player.projected_fpts.toFixed(1)} FPTS
              </span>
            </div>
          </div>
        ))}

        {/* Show empty slots */}
        {slotsNeeded.map((slot, idx) => (
          <div
            key={`empty-${slot}-${idx}`}
            className="flex justify-between items-center p-2 bg-muted/50 rounded border-2 border-dashed border-border"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded text-muted-foreground">
                {slot}
              </span>
              <span className="text-muted-foreground italic">Empty</span>
            </div>
          </div>
        ))}
      </div>

      {/* Roster totals */}
      {roster.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border flex justify-between text-sm">
          <span className="text-muted-foreground">Total: {roster.length} players</span>
          <div className="space-x-4">
            <span className="font-semibold text-foreground">${totalCost}</span>
            <span className="text-muted-foreground">{totalFpts.toFixed(1)} FPTS</span>
          </div>
        </div>
      )}
    </div>
  );
}
