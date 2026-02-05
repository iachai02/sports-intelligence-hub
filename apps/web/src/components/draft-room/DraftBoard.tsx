import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, LayoutGrid } from 'lucide-react';
import type { BoardState, BoardTeam, BoardPick, RoomMember } from '../../lib/types';
import { cn } from '../../lib/utils';

interface DraftBoardProps {
  boardState: BoardState | null;
  myMemberId: number | null;
  isLoading: boolean;
  members?: RoomMember[];
  onPlayerClick?: (playerId: string) => void;
}

export function DraftBoard({ boardState, myMemberId, isLoading, members, onPlayerClick }: DraftBoardProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [recentPickKey, setRecentPickKey] = useState<string | null>(null);

  // Track new picks for flash animation
  const prevTotalPicksRef = useRef<number>(0);
  useEffect(() => {
    if (!boardState) return;
    if (boardState.total_picks > prevTotalPicksRef.current) {
      // Find the most recent pick across all teams
      let latestPick: { teamId: number; pick: BoardPick } | null = null;
      for (const team of boardState.teams) {
        for (const pick of team.picks) {
          if (
            !latestPick ||
            new Date(pick.picked_at) > new Date(latestPick.pick.picked_at)
          ) {
            latestPick = { teamId: team.member_id, pick };
          }
        }
      }
      if (latestPick) {
        const key = `${latestPick.teamId}-${latestPick.pick.player_id}`;
        setRecentPickKey(key);
        const timer = setTimeout(() => setRecentPickKey(null), 2000);
        return () => clearTimeout(timer);
      }
    }
    prevTotalPicksRef.current = boardState.total_picks;
  }, [boardState]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <span className="ml-3 text-muted-foreground">Loading draft board...</span>
      </div>
    );
  }

  if (!boardState || boardState.teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LayoutGrid className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-foreground font-medium mb-1">No board data</p>
        <p className="text-sm text-muted-foreground">
          The draft board will appear once the draft starts
        </p>
      </div>
    );
  }

  const { teams, roster_size } = boardState;
  const sortedTeams = [...teams].sort((a, b) => a.team_order - b.team_order);
  const maxSlots = roster_size;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)] rounded-xl border border-border bg-card"
      >
        <table className="w-full border-collapse min-w-[600px]">
          {/* Header row - team names */}
          <thead>
            <tr>
              {/* Sticky slot label column header */}
              <th className="sticky left-0 z-20 bg-card border-b border-r border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left min-w-[56px]">
                Slot
              </th>
              {sortedTeams.map((team) => {
                const isMyTeam = team.member_id === myMemberId;
                const member = members?.find((m) => m.id === team.member_id);
                const memberName = member?.user_name;
                return (
                  <th
                    key={team.member_id}
                    className={cn(
                      'border-b border-border px-2 py-2.5 text-xs font-semibold text-center min-w-[120px] max-w-[160px]',
                      isMyTeam
                        ? 'bg-accent/10 text-accent border-x border-accent/30'
                        : 'text-foreground',
                    )}
                  >
                    <div className="truncate">{team.team_name}</div>
                    {memberName && (
                      <div className="text-[10px] text-muted-foreground font-normal truncate">
                        {memberName}
                      </div>
                    )}
                    {team.is_phantom && (
                      <span className="text-[10px] text-muted-foreground font-normal">
                        (unfilled)
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {/* Pick rows */}
            {Array.from({ length: maxSlots }, (_, slotIdx) => (
              <tr key={slotIdx} className="group">
                {/* Sticky slot label */}
                <td className="sticky left-0 z-10 bg-card border-r border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground tabular-nums">
                  {slotIdx + 1}
                </td>

                {/* Team cells */}
                {sortedTeams.map((team) => {
                  const pick = getPickForSlot(team, slotIdx);
                  const isMyTeam = team.member_id === myMemberId;
                  const cellKey = `${team.member_id}-${pick?.player_id}`;
                  const isRecent = pick && cellKey === recentPickKey;

                  return (
                    <td
                      key={team.member_id}
                      className={cn(
                        'border-b border-border px-2 py-1.5 text-center relative',
                        isMyTeam && 'border-x border-accent/30 bg-accent/5',
                        !pick && 'bg-transparent',
                      )}
                    >
                      <AnimatePresence mode="wait">
                        {pick ? (
                          <motion.div
                            key={pick.player_id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => onPlayerClick?.(pick.player_id)}
                            className={cn(
                              'rounded-lg px-2 py-1.5 transition-shadow duration-500',
                              onPlayerClick && 'cursor-pointer hover:bg-muted/40',
                              isRecent && 'ring-2 ring-accent shadow-[0_0_12px_hsl(var(--accent)/0.4)]',
                            )}
                          >
                            <div className="text-xs font-medium text-foreground truncate">
                              {pick.player_name}
                            </div>
                            <div className="text-[11px] font-bold text-stat-positive tabular-nums">
                              ${pick.purchase_price}
                            </div>
                            {pick.slot && (
                              <div className="text-[10px] text-muted-foreground">
                                {pick.slot}
                              </div>
                            )}
                          </motion.div>
                        ) : (
                          <motion.div
                            key={`empty-${slotIdx}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-2"
                          >
                            <div className="h-4 w-full rounded bg-muted/30" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Budget footer row */}
            <tr>
              <td className="sticky left-0 z-10 bg-card border-r border-t-2 border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                Budget
              </td>
              {sortedTeams.map((team) => {
                const isMyTeam = team.member_id === myMemberId;
                const budgetPct =
                  team.budget_total > 0
                    ? (team.budget_remaining / team.budget_total) * 100
                    : 0;

                return (
                  <td
                    key={team.member_id}
                    className={cn(
                      'border-t-2 border-border px-2 py-2.5 text-center',
                      isMyTeam && 'border-x border-accent/30 bg-accent/5',
                    )}
                  >
                    <div className="text-xs font-bold tabular-nums text-foreground">
                      ${team.budget_remaining}
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      ${team.total_spent} spent
                    </div>
                    {/* Mini budget bar */}
                    <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={cn(
                          'h-full rounded-full',
                          budgetPct > 50
                            ? 'bg-stat-positive'
                            : budgetPct > 20
                              ? 'bg-amber-400'
                              : 'bg-stat-negative',
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${budgetPct}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.15 }}
        className="flex items-center justify-between mt-3 text-xs text-muted-foreground px-1"
      >
        <span>
          {boardState.total_picks} picks made across {boardState.num_teams} teams
        </span>
        <span>
          {maxSlots} roster slots per team
        </span>
      </motion.div>
    </motion.div>
  );
}

/**
 * Get the pick at a given slot index for a team.
 * Picks are sorted by pick_order or picked_at and mapped to slot indices.
 */
function getPickForSlot(team: BoardTeam, slotIdx: number): BoardPick | undefined {
  const sortedPicks = [...team.picks].sort((a, b) => {
    if (a.pick_order !== null && b.pick_order !== null) {
      return a.pick_order - b.pick_order;
    }
    return new Date(a.picked_at).getTime() - new Date(b.picked_at).getTime();
  });
  return sortedPicks[slotIdx];
}
