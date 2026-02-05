import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  User,
  ShoppingCart,
} from 'lucide-react';
import type { BoardTeam } from '../../lib/types';
import { PositionBadge } from './PositionBadge';
import { cn } from '../../lib/utils';

interface TeamDetailPanelProps {
  team: BoardTeam;
  isExpanded: boolean;
  onToggle: () => void;
  playerPool?: Record<string, { name: string; position: string }>;
}

export function TeamDetailPanel({
  team,
  isExpanded,
  onToggle,
  playerPool,
}: TeamDetailPanelProps) {
  const budgetPct =
    team.budget_total > 0
      ? (team.budget_remaining / team.budget_total) * 100
      : 0;

  const sortedPicks = [...team.picks].sort((a, b) => {
    if (a.pick_order !== null && b.pick_order !== null) {
      return a.pick_order - b.pick_order;
    }
    return new Date(a.picked_at).getTime() - new Date(b.picked_at).getTime();
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      {/* Clickable header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Team avatar / icon */}
          <div
            className={cn(
              'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
              team.is_phantom
                ? 'bg-muted border-2 border-dashed border-border'
                : 'bg-accent/15',
            )}
          >
            <User
              className={cn(
                'h-4 w-4',
                team.is_phantom ? 'text-muted-foreground/40' : 'text-accent',
              )}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-sm truncate">
                {team.team_name}
              </span>
              {team.is_phantom && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  Unfilled
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-0.5">
                <ShoppingCart className="h-3 w-3" />
                {team.pick_count} picks
              </span>
              <span>&middot;</span>
              <span className="flex items-center gap-0.5">
                <DollarSign className="h-3 w-3" />
                {team.budget_remaining} left
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Budget bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
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
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
              {Math.round(budgetPct)}%
            </span>
          </div>

          {/* Expand/collapse icon */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </motion.div>
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-border">
              {/* Budget summary */}
              <div className="px-4 py-3 bg-muted/30">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Budget
                    </div>
                    <div className="text-sm font-bold text-foreground tabular-nums">
                      ${team.budget_total}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Spent
                    </div>
                    <div className="text-sm font-bold text-stat-negative tabular-nums">
                      ${team.total_spent}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Remaining
                    </div>
                    <div
                      className={cn(
                        'text-sm font-bold tabular-nums',
                        budgetPct > 30
                          ? 'text-stat-positive'
                          : budgetPct > 10
                            ? 'text-amber-400'
                            : 'text-stat-negative',
                      )}
                    >
                      ${team.budget_remaining}
                    </div>
                  </div>
                </div>
              </div>

              {/* Picks list */}
              {sortedPicks.length > 0 ? (
                <div className="divide-y divide-border">
                  {sortedPicks.map((pick, idx) => {
                    const playerInfo = playerPool?.[pick.player_id];
                    const displayName = playerInfo?.name || pick.player_id;
                    const position = playerInfo?.position || pick.slot || '';

                    return (
                      <motion.div
                        key={pick.player_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15, delay: idx * 0.03 }}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] text-muted-foreground tabular-nums w-5 text-right shrink-0">
                            {idx + 1}.
                          </span>
                          {position && <PositionBadge position={position} />}
                          <span className="text-sm font-medium text-foreground truncate">
                            {displayName}
                          </span>
                          {pick.slot && pick.slot !== position && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {pick.slot}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-stat-positive tabular-nums shrink-0">
                          ${pick.purchase_price}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No picks yet
                  </p>
                </div>
              )}

              {/* Average cost per pick */}
              {sortedPicks.length > 0 && (
                <div className="px-4 py-2.5 bg-muted/20 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Avg. cost per pick
                  </span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">
                    ${team.pick_count > 0 ? Math.round(team.total_spent / team.pick_count) : 0}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
