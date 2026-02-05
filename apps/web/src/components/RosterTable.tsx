import type { SelectedPlayer } from '../lib/types';

interface RosterTableProps {
  roster: SelectedPlayer[];
  rosterSize: number;
}

export function RosterTable({ roster, rosterSize }: RosterTableProps) {
  return (
    <div className="bg-card border border-border rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">
          Optimized Roster ({rosterSize} players)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Slot
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Player
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Team
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Position
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Proj FPTS
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Cost
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {roster.map((player) => (
              <tr
                key={player.id}
                className={player.is_starter ? '' : 'bg-muted/50'}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                  {player.slot}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                  {player.name}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                  {player.team}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                  {player.position}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-foreground">
                  {player.projected_fpts.toFixed(1)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-foreground">
                  ${player.auction_value.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
