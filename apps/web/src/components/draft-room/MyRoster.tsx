import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Undo2, User, Trophy } from 'lucide-react';
import type { RosterPlayer } from '../../lib/types';
import { AnimatedCard } from './AnimatedCard';
import { PositionBadge } from './PositionBadge';
import { cn } from '../../lib/utils';

interface MyRosterProps {
  roster: RosterPlayer[];
  slotsNeeded: string[];
  onUndo: () => void;
  onPlayerClick?: (player: RosterPlayer) => void;
}

// Slot display order matching the standard fantasy lineup
const SLOT_ORDER: Record<string, number> = {
  PG: 0,
  SG: 1,
  G: 2,
  SF: 3,
  PF: 4,
  F: 5,
  C: 6,
  UTIL: 7,
  BENCH: 8,
};

function getSlotOrder(slot: string): number {
  return SLOT_ORDER[slot] ?? 99;
}

type RosterRow =
  | { type: 'filled'; player: RosterPlayer; slotOrder: number }
  | { type: 'empty'; slot: string; idx: number; slotOrder: number };

export function MyRoster({ roster, slotsNeeded, onUndo, onPlayerClick }: MyRosterProps) {
  const totalCost = roster.reduce((sum, p) => sum + p.cost, 0);
  const totalFpts = roster.reduce((sum, p) => sum + p.projected_fpts, 0);

  // Build a unified roster view sorted by slot position
  const rows = useMemo<RosterRow[]>(() => {
    const filled: RosterRow[] = roster.map((p) => ({
      type: 'filled' as const,
      player: p,
      slotOrder: getSlotOrder(p.slot),
    }));
    const empty: RosterRow[] = slotsNeeded.map((slot, idx) => ({
      type: 'empty' as const,
      slot,
      idx,
      slotOrder: getSlotOrder(slot),
    }));
    return [...filled, ...empty].sort((a, b) => a.slotOrder - b.slotOrder);
  }, [roster, slotsNeeded]);

  return (
    <AnimatedCard className="p-5" delay={0.1}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Trophy className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">My Roster</h3>
            <span className="text-[11px] text-muted-foreground">
              {roster.length} drafted &middot; {slotsNeeded.length} open
            </span>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onUndo}
          disabled={roster.length === 0}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
            'bg-muted hover:bg-muted/80 text-foreground',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-muted',
          )}
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </motion.button>
      </div>

      {/* Roster list - sorted by slot position */}
      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {rows.map((row, index) => {
            if (row.type === 'filled') {
              const player = row.player;
              return (
                <motion.div
                  key={player.player_id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  layout
                  onClick={() => onPlayerClick?.(player)}
                  className={cn(
                    'flex items-center justify-between gap-2 px-3 py-2.5 bg-accent/5 rounded-lg border border-accent/10 hover:border-accent/25 transition-colors',
                    onPlayerClick && 'cursor-pointer',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <PositionBadge position={player.position} />
                    <span className="text-[10px] text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded">
                      {player.slot}
                    </span>
                    <span className="font-medium text-foreground text-sm truncate">
                      {player.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {player.team}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-bold text-stat-positive text-sm tabular-nums">
                      ${player.cost}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {player.projected_fpts.toFixed(1)}
                    </span>
                  </div>
                </motion.div>
              );
            } else {
              return (
                <motion.div
                  key={`empty-${row.slot}-${row.idx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 + index * 0.02 }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-2 border-dashed border-border/60 bg-muted/20"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted/60 px-1.5 py-0.5 rounded">
                    {row.slot}
                  </span>
                  <span className="text-xs text-muted-foreground/40 italic">Empty</span>
                </motion.div>
              );
            }
          })}
        </AnimatePresence>
      </div>

      {/* Roster totals */}
      <AnimatePresence>
        {roster.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 pt-3 border-t border-border flex items-center justify-between"
          >
            <span className="text-xs text-muted-foreground">
              {roster.length} player{roster.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-4 text-sm">
              <span className="font-semibold text-foreground tabular-nums">${totalCost}</span>
              <span className="text-muted-foreground tabular-nums">
                {totalFpts.toFixed(1)} FPTS
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatedCard>
  );
}
