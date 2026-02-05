import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, Target, Trophy, Loader2 } from 'lucide-react';
import type { PlayerSearchResult, PlayerStats } from '../../lib/types';
import { getPlayerDetail } from '../../lib/api';
import { PositionBadge } from './PositionBadge';
import { StatBar } from '../player-stats/StatBar';
import { cn } from '../../lib/utils';

interface DraftPlayerDetailModalProps {
  player: PlayerSearchResult | null;
  isOpen: boolean;
  onClose: () => void;
  onReportPick: (player: PlayerSearchResult) => void;
}

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

export function DraftPlayerDetailModal({
  player,
  isOpen,
  onClose,
  onReportPick,
}: DraftPlayerDetailModalProps) {
  const [detail, setDetail] = useState<PlayerStats | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    if (!isOpen || !player) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setIsLoadingDetail(true);

    getPlayerDetail(player.player_id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        // Detail fetch may fail; modal still shows basic info
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, player]);

  if (!player) return null;

  const isTaken = !player.is_available;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="draft-detail-title"
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
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-lg font-semibold text-muted-foreground">
                      {player.position}
                    </span>
                  </div>

                  <div>
                    <h2 id="draft-detail-title" className="text-xl font-semibold text-foreground">
                      {player.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-muted-foreground">{player.team}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <PositionBadge position={player.position} size="md" />
                      {isTaken && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span className="text-[10px] font-semibold text-stat-negative bg-stat-negative/10 px-1.5 py-0.5 rounded">
                            Taken
                          </span>
                        </>
                      )}
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
                      <span className="text-[10px] uppercase tracking-wide font-medium">Auction Value</span>
                    </div>
                    <div className="text-2xl font-bold text-accent">
                      ${player.auction_value}
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-[10px] uppercase tracking-wide font-medium">Projected FPTS</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {player.projected_fpts.toFixed(1)}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                {isLoadingDetail ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-accent" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading stats...</span>
                  </div>
                ) : detail ? (
                  <div>
                    <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-3">
                      Season Statistics
                    </h3>
                    <div className="space-y-2.5">
                      <StatBar label="PPG" value={detail.ppg} maxValue={STAT_MAX.ppg} />
                      <StatBar label="RPG" value={detail.rpg} maxValue={STAT_MAX.rpg} />
                      <StatBar label="APG" value={detail.apg} maxValue={STAT_MAX.apg} />
                      <StatBar label="SPG" value={detail.spg} maxValue={STAT_MAX.spg} />
                      <StatBar label="BPG" value={detail.bpg} maxValue={STAT_MAX.bpg} />
                      <StatBar label="TOV" value={detail.topg} maxValue={STAT_MAX.topg} />
                      <StatBar label="FG%" value={detail.fg_pct} maxValue={STAT_MAX.fg_pct} isPercentage />
                      <StatBar label="FT%" value={detail.ft_pct} maxValue={STAT_MAX.ft_pct} isPercentage />
                      <StatBar label="3PM" value={detail.three_pm} maxValue={STAT_MAX.three_pm} />
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border flex gap-3">
                <button
                  onClick={() => onReportPick(player)}
                  disabled={isTaken}
                  className={cn(
                    'flex-1 h-11 rounded-lg font-medium transition-all duration-150',
                    'flex items-center justify-center gap-2',
                    isTaken
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-accent text-accent-foreground hover:bg-accent/90',
                  )}
                >
                  <Trophy className="h-4 w-4" />
                  {isTaken ? 'Player Taken' : 'Report Pick'}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 h-11 rounded-lg font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
