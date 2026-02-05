import { useState } from 'react';
import type { TakenPlayer } from '../../lib/types';

interface TakenPlayersPanelProps {
  takenPlayers: TakenPlayer[];
}

export function TakenPlayersPanel({ takenPlayers }: TakenPlayersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-card border border-border rounded-lg shadow">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex justify-between items-center hover:bg-muted/50 transition"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Taken Players</h3>
          <span className="bg-muted text-muted-foreground text-sm px-2 py-0.5 rounded-full">
            {takenPlayers.length}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="border-t border-border">
          {takenPlayers.length === 0 ? (
            <p className="px-4 py-3 text-muted-foreground text-sm">
              No players marked as taken yet.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Player</th>
                    <th className="px-2 py-2 text-center font-medium text-muted-foreground">Pos</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">FPTS</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {takenPlayers.map((player) => (
                    <tr key={player.player_id} className="hover:bg-muted/50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-foreground">{player.name}</div>
                        <div className="text-xs text-muted-foreground">{player.team}</div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="bg-muted px-1.5 py-0.5 rounded text-xs text-muted-foreground">
                          {player.position}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        {player.projected_fpts.toFixed(1)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-foreground">
                        ${player.auction_value.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
