import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronUp, ChevronDown, Users } from 'lucide-react';
import { useState } from 'react';
import type { PlayerStats } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';
import { ComparisonStatBar } from './StatBar';

interface PlayerComparisonViewProps {
  players: PlayerStats[];
  onRemovePlayer: (playerId: string) => void;
  onClearAll: () => void;
}

const PLAYER_COLORS = ['#3B82F6', '#10B981', '#F59E0B'];

// Max values for stat bars
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
  auction_value: 80,
  projected_fpts: 70,
};

export function PlayerComparisonView({
  players,
  onRemovePlayer,
  onClearAll,
}: PlayerComparisonViewProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (players.length === 0) return null;

  const renderComparisonStat = (
    label: string,
    getValue: (p: PlayerStats) => number,
    maxValue: number,
    isPercentage = false,
  ) => {
    const values = players.map((player, index) => ({
      playerId: player.player_id,
      value: getValue(player),
      color: PLAYER_COLORS[index],
    }));

    return (
      <ComparisonStatBar
        key={label}
        label={label}
        values={values}
        maxValue={maxValue}
        isPercentage={isPercentage}
      />
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-2xl"
      >
        {/* Header - always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
          aria-expanded={isExpanded}
          aria-controls="comparison-content"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-foreground">
                Compare Players
              </h3>
              <p className="text-sm text-muted-foreground">
                {players.length} of 3 selected
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {players.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearAll();
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
              >
                Clear all
              </button>
            )}
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Expandable content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              id="comparison-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 pt-2">
                {/* Player chips */}
                <div className="flex flex-wrap gap-3 mb-6">
                  {players.map((player, index) => (
                    <motion.div
                      key={player.player_id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-3 bg-muted rounded-lg pl-3 pr-2 py-2"
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: PLAYER_COLORS[index] }}
                      />
                      <div className="text-left">
                        <div className="font-medium text-sm text-foreground">{player.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {player.team} · {formatCurrency(player.auction_value)}
                        </div>
                      </div>
                      <button
                        onClick={() => onRemovePlayer(player.player_id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                        aria-label={`Remove ${player.name} from comparison`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}

                  {/* Empty slots */}
                  {Array.from({ length: 3 - players.length }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex items-center gap-3 border border-dashed border-border rounded-lg px-4 py-3"
                    >
                      <span className="text-sm text-muted-foreground">
                        Select a player
                      </span>
                    </div>
                  ))}
                </div>

                {/* Stat comparison - only show when 2+ players selected */}
                {players.length >= 2 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
                    {renderComparisonStat('Value', (p) => p.auction_value, STAT_MAX.auction_value)}
                    {renderComparisonStat('FPTS', (p) => p.projected_fpts, STAT_MAX.projected_fpts)}
                    {renderComparisonStat('PPG', (p) => p.ppg, STAT_MAX.ppg)}
                    {renderComparisonStat('RPG', (p) => p.rpg, STAT_MAX.rpg)}
                    {renderComparisonStat('APG', (p) => p.apg, STAT_MAX.apg)}
                    {renderComparisonStat('SPG', (p) => p.spg, STAT_MAX.spg)}
                    {renderComparisonStat('BPG', (p) => p.bpg, STAT_MAX.bpg)}
                    {renderComparisonStat('TOV', (p) => p.topg, STAT_MAX.topg)}
                    {renderComparisonStat('FG%', (p) => p.fg_pct, STAT_MAX.fg_pct, true)}
                    {renderComparisonStat('FT%', (p) => p.ft_pct, STAT_MAX.ft_pct, true)}
                    {renderComparisonStat('3PM', (p) => p.three_pm, STAT_MAX.three_pm)}
                  </div>
                )}

                {/* Prompt when only 1 player selected */}
                {players.length === 1 && (
                  <div className="text-center py-4 text-muted-foreground">
                    Select one more player to start comparing
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
