import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, TrendingUp, Target } from 'lucide-react';
import type { PlayerStats } from '../../lib/types';
import { cn, formatCurrency, formatStat } from '../../lib/utils';
import { StatBar } from './StatBar';

interface PlayerDetailModalProps {
  player: PlayerStats | null;
  onClose: () => void;
  onAddToCompare: (playerId: string) => void;
  isInCompare: boolean;
}

// Max values for stat bars (based on typical league leaders)
const STAT_MAX = {
  ppg: 35,
  rpg: 15,
  apg: 12,
  spg: 2.5,
  bpg: 3.5,
  topg: 5,
  fg_pct: 0.7,
  ft_pct: 1.0,
  three_pm: 5,
};

export function PlayerDetailModal({
  player,
  onClose,
  onAddToCompare,
  isInCompare,
}: PlayerDetailModalProps) {
  if (!player) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 border-b border-border">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-4">
              {/* Avatar placeholder */}
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-lg font-semibold text-muted-foreground">
                  {player.position}
                </span>
              </div>

              <div>
                <h2 id="modal-title" className="text-xl font-semibold text-foreground">
                  {player.name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-muted-foreground">{player.team}</span>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-xs font-medium text-muted-foreground">
                    {player.position}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-6">
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-accent/10 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Target className="h-4 w-4" />
                  <span className="text-stat-label uppercase tracking-wide">Auction Value</span>
                </div>
                <div className="text-2xl font-bold text-accent">
                  {formatCurrency(player.auction_value)}
                </div>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-stat-label uppercase tracking-wide">Projected FPTS</span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {formatStat(player.projected_fpts)}
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div>
              <h3 className="text-stat-label uppercase tracking-wide text-muted-foreground mb-3">
                Season Statistics
              </h3>
              <div className="space-y-2.5">
                <StatBar label="PPG" value={player.ppg} maxValue={STAT_MAX.ppg} />
                <StatBar label="RPG" value={player.rpg} maxValue={STAT_MAX.rpg} />
                <StatBar label="APG" value={player.apg} maxValue={STAT_MAX.apg} />
                <StatBar label="SPG" value={player.spg} maxValue={STAT_MAX.spg} />
                <StatBar label="BPG" value={player.bpg} maxValue={STAT_MAX.bpg} />
                <StatBar label="TOV" value={player.topg} maxValue={STAT_MAX.topg} />
                <StatBar label="FG%" value={player.fg_pct} maxValue={STAT_MAX.fg_pct} isPercentage />
                <StatBar label="FT%" value={player.ft_pct} maxValue={STAT_MAX.ft_pct} isPercentage />
                <StatBar label="3PM" value={player.three_pm} maxValue={STAT_MAX.three_pm} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex gap-3">
            <button
              onClick={() => onAddToCompare(player.player_id)}
              disabled={isInCompare}
              className={cn(
                'flex-1 h-11 rounded-lg font-medium transition-all duration-150',
                'flex items-center justify-center gap-2',
                isInCompare
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-accent text-accent-foreground hover:bg-accent/90'
              )}
            >
              {isInCompare ? (
                'Already Comparing'
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add to Compare
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 h-11 rounded-lg font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
