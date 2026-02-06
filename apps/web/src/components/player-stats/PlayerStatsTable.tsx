import { motion } from 'framer-motion';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { PlayerStats, PlayerStatsFilters } from '../../lib/types';
import { cn, formatCurrency, formatPercent, formatStat } from '../../lib/utils';

interface PlayerStatsTableProps {
  players: PlayerStats[];
  filters: PlayerStatsFilters;
  onFiltersChange: (filters: PlayerStatsFilters) => void;
  selectedPlayerIds: string[];
  onToggleSelect: (playerId: string) => void;
  onRowClick: (playerId: string) => void;
  totalPages: number;
  isLoading?: boolean;
}

type SortColumn = 'name' | 'team' | 'position' | 'auction_value' | 'projected_fpts' | 'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg' | 'topg' | 'fg_pct' | 'ft_pct' | 'three_pm';

interface Column {
  key: SortColumn;
  label: string;
  shortLabel?: string;
  align: 'left' | 'right';
  width?: string;
  format?: (value: number) => string;
}

const COLUMNS: Column[] = [
  { key: 'name', label: 'Player', align: 'left', width: 'min-w-[140px]' },
  { key: 'team', label: 'Team', align: 'left', width: 'w-12' },
  { key: 'position', label: 'Pos', align: 'left', width: 'w-10' },
  { key: 'auction_value', label: 'Value', align: 'right', width: 'w-14', format: formatCurrency },
  { key: 'projected_fpts', label: 'FPTS', align: 'right', width: 'w-12', format: (v) => formatStat(v) },
  { key: 'fg_pct', label: 'FG%', align: 'right', width: 'w-12', format: formatPercent },
  { key: 'ft_pct', label: 'FT%', align: 'right', width: 'w-12', format: formatPercent },
  { key: 'three_pm', label: '3PM', align: 'right', width: 'w-10', format: (v) => formatStat(v) },
  { key: 'ppg', label: 'PPG', align: 'right', width: 'w-10', format: (v) => formatStat(v) },
  { key: 'rpg', label: 'RPG', align: 'right', width: 'w-10', format: (v) => formatStat(v) },
  { key: 'apg', label: 'APG', align: 'right', width: 'w-10', format: (v) => formatStat(v) },
  { key: 'spg', label: 'SPG', align: 'right', width: 'w-10', format: (v) => formatStat(v) },
  { key: 'bpg', label: 'BPG', align: 'right', width: 'w-10', format: (v) => formatStat(v) },
  { key: 'topg', label: 'TOV', align: 'right', width: 'w-10', format: (v) => formatStat(v) },
];

function SortIcon({ column, currentSort, sortOrder }: { column: SortColumn; currentSort: string; sortOrder: 'asc' | 'desc' }) {
  if (currentSort !== column) {
    return <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />;
  }
  return sortOrder === 'desc'
    ? <ArrowDown className="h-3 w-3 text-accent" />
    : <ArrowUp className="h-3 w-3 text-accent" />;
}

export function PlayerStatsTable({
  players,
  filters,
  onFiltersChange,
  selectedPlayerIds,
  onToggleSelect,
  onRowClick,
  totalPages,
  isLoading = false,
}: PlayerStatsTableProps) {
  const handleSort = (column: SortColumn) => {
    if (filters.sortBy === column) {
      onFiltersChange({
        ...filters,
        sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc',
      });
    } else {
      onFiltersChange({
        ...filters,
        sortBy: column,
        sortOrder: 'desc',
      });
    }
  };

  const getValue = (player: PlayerStats, key: SortColumn): string | number => {
    switch (key) {
      case 'name': return player.name;
      case 'team': return player.team;
      case 'position': return player.position;
      case 'auction_value': return player.auction_value;
      case 'projected_fpts': return player.projected_fpts;
      case 'ppg': return player.ppg;
      case 'rpg': return player.rpg;
      case 'apg': return player.apg;
      case 'spg': return player.spg;
      case 'bpg': return player.bpg;
      case 'topg': return player.topg;
      case 'fg_pct': return player.fg_pct;
      case 'ft_pct': return player.ft_pct;
      case 'three_pm': return player.three_pm;
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Table */}
      <div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {/* Checkbox column */}
              <th className="w-10 px-2 py-3">
                <span className="sr-only">Select</span>
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-2 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider',
                    'cursor-pointer select-none group transition-colors hover:text-foreground',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.width
                  )}
                  onClick={() => handleSort(col.key)}
                  role="columnheader"
                  aria-sort={filters.sortBy === col.key ? (filters.sortOrder === 'desc' ? 'descending' : 'ascending') : 'none'}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.shortLabel || col.label}
                    <SortIcon column={col.key} currentSort={filters.sortBy} sortOrder={filters.sortOrder} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cn(isLoading && 'opacity-50 pointer-events-none')}>
            {players.map((player, index) => {
              const isSelected = selectedPlayerIds.includes(player.player_id);
              const canSelect = isSelected || selectedPlayerIds.length < 3;

              return (
                <motion.tr
                  key={player.player_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: index * 0.02 }}
                  onClick={() => onRowClick(player.player_id)}
                  className={cn(
                    'border-b border-border/50 cursor-pointer transition-colors',
                    isSelected ? 'bg-accent/10' : 'hover:bg-muted/50'
                  )}
                  role="row"
                  aria-selected={isSelected}
                >
                  {/* Checkbox */}
                  <td className="px-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => canSelect && onToggleSelect(player.player_id)}
                      disabled={!canSelect}
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                        isSelected
                          ? 'bg-accent border-accent'
                          : 'border-border hover:border-accent/50',
                        !canSelect && !isSelected && 'opacity-30 cursor-not-allowed'
                      )}
                      aria-label={isSelected ? `Remove ${player.name} from comparison` : `Add ${player.name} to comparison`}
                      aria-pressed={isSelected}
                    >
                      {isSelected && <Check className="h-3 w-3 text-accent-foreground" />}
                    </button>
                  </td>

                  {/* Data cells */}
                  {COLUMNS.map((col) => {
                    const value = getValue(player, col.key);

                    // Special rendering for certain columns
                    if (col.key === 'name') {
                      return (
                        <td key={col.key} className={cn('px-2 py-2', col.width)}>
                          <span className="font-medium text-foreground text-sm">{value}</span>
                        </td>
                      );
                    }

                    if (col.key === 'team') {
                      return (
                        <td key={col.key} className={cn('px-2 py-2', col.width)}>
                          <span className="text-muted-foreground text-xs">{value}</span>
                        </td>
                      );
                    }

                    if (col.key === 'position') {
                      return (
                        <td key={col.key} className={cn('px-2 py-2', col.width)}>
                          <span className="inline-flex items-center justify-center w-7 h-5 rounded bg-muted text-[10px] font-medium text-muted-foreground">
                            {value}
                          </span>
                        </td>
                      );
                    }

                    if (col.key === 'auction_value') {
                      return (
                        <td key={col.key} className={cn('px-2 py-2 text-right', col.width)}>
                          <span className="font-semibold text-accent tabular-nums text-sm">
                            {col.format ? col.format(value as number) : value}
                          </span>
                        </td>
                      );
                    }

                    if (col.key === 'topg') {
                      return (
                        <td key={col.key} className={cn('px-2 py-2 text-right', col.width)}>
                          <span className="text-stat-negative font-mono tabular-nums text-xs">
                            {col.format ? col.format(value as number) : value}
                          </span>
                        </td>
                      );
                    }

                    return (
                      <td key={col.key} className={cn('px-2 py-2', col.align === 'right' ? 'text-right' : 'text-left', col.width)}>
                        <span className="font-mono tabular-nums text-xs text-foreground/90">
                          {col.format ? col.format(value as number) : value}
                        </span>
                      </td>
                    );
                  })}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page <span className="font-medium text-foreground">{filters.page}</span> of{' '}
          <span className="font-medium text-foreground">{totalPages}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onFiltersChange({ ...filters, page: filters.page - 1 })}
            disabled={filters.page <= 1}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed'
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onFiltersChange({ ...filters, page: filters.page + 1 })}
            disabled={filters.page >= totalPages}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed'
            )}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
