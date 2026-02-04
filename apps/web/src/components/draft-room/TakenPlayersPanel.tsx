import { useState } from 'react';
import type { TakenPlayer } from '../../lib/types';

interface TakenPlayersPanelProps {
  takenPlayers: TakenPlayer[];
}

export function TakenPlayersPanel({ takenPlayers }: TakenPlayersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-700">Taken Players</h3>
          <span className="bg-gray-200 text-gray-600 text-sm px-2 py-0.5 rounded-full">
            {takenPlayers.length}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="border-t">
          {takenPlayers.length === 0 ? (
            <p className="px-4 py-3 text-gray-500 text-sm">
              No players marked as taken yet.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Player</th>
                    <th className="px-2 py-2 text-center font-medium text-gray-500">Pos</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500">FPTS</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {takenPlayers.map((player) => (
                    <tr key={player.player_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-700">{player.name}</div>
                        <div className="text-xs text-gray-400">{player.team}</div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">
                          {player.position}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-gray-600">
                        {player.projected_fpts.toFixed(1)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-700">
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
