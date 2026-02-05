import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronDown, Loader2 } from 'lucide-react';
import type { PlayerStatsFilters, PlayerStatsSearchResult } from '../../lib/types';
import { searchPlayers } from '../../lib/playerStatsApi';
import { cn } from '../../lib/utils';

interface PlayerStatsFiltersPanelProps {
  filters: PlayerStatsFilters;
  onFiltersChange: (filters: PlayerStatsFilters) => void;
  teams: string[];
  onSelectPlayer?: (playerId: string) => void;
}

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;

export function PlayerStatsFiltersPanel({
  filters,
  onFiltersChange,
  teams,
  onSelectPlayer,
}: PlayerStatsFiltersPanelProps) {
  const [searchQuery, setSearchQuery] = useState(filters.search || '');
  const [searchResults, setSearchResults] = useState<PlayerStatsSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsSearching(true);
      try {
        const results = await searchPlayers(searchQuery, 10, abortControllerRef.current.signal);
        setSearchResults(results);
        setShowDropdown(true);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Search error:', error);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = () => {
    onFiltersChange({ ...filters, search: searchQuery || undefined, page: 1 });
    setShowDropdown(false);
  };

  const handleSelectSearchResult = (player: PlayerStatsSearchResult) => {
    if (onSelectPlayer) {
      onSelectPlayer(player.player_id);
    }
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    onFiltersChange({ ...filters, search: undefined, page: 1 });
    setShowDropdown(false);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchSubmit();
              if (e.key === 'Escape') setShowDropdown(false);
            }}
            placeholder="Search players..."
            className={cn(
              'w-full h-12 pl-11 pr-20 rounded-lg',
              'bg-input border border-border',
              'text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent',
              'transition-all duration-150'
            )}
            aria-label="Search players"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="search-results"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isSearching && (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            )}
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search Dropdown */}
        <AnimatePresence>
          {showDropdown && searchResults.length > 0 && (
            <motion.div
              id="search-results"
              role="listbox"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 w-full mt-2 bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
            >
              {searchResults.map((player, index) => (
                <button
                  key={player.player_id}
                  role="option"
                  onClick={() => handleSelectSearchResult(player)}
                  className={cn(
                    'w-full px-4 py-3 flex items-center justify-between',
                    'hover:bg-muted transition-colors',
                    'focus:outline-none focus:bg-muted',
                    index !== searchResults.length - 1 && 'border-b border-border'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-xs font-medium text-muted-foreground">
                        {player.position}
                      </span>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-foreground">{player.name}</div>
                      <div className="text-sm text-muted-foreground">{player.team}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-accent">
                      ${player.auction_value.toFixed(0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {player.projected_fpts.toFixed(1)} FPTS
                    </div>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Position Filter */}
        <div className="flex items-center bg-input border border-border rounded-lg p-1">
          <button
            onClick={() => onFiltersChange({ ...filters, position: undefined, page: 1 })}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150',
              !filters.position
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            aria-pressed={!filters.position}
          >
            All
          </button>
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => onFiltersChange({ ...filters, position: pos, page: 1 })}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150',
                filters.position === pos
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              aria-pressed={filters.position === pos}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* Team Dropdown */}
        <div className="relative">
          <select
            value={filters.team || ''}
            onChange={(e) => onFiltersChange({ ...filters, team: e.target.value || undefined, page: 1 })}
            className={cn(
              'h-10 pl-4 pr-10 rounded-lg appearance-none cursor-pointer',
              'bg-input border border-border',
              'text-sm font-medium',
              filters.team ? 'text-foreground' : 'text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent',
              'transition-all duration-150'
            )}
            aria-label="Filter by team"
          >
            <option value="">All Teams</option>
            {teams.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Active filters indicator */}
        {(filters.position || filters.team || filters.search) && (
          <button
            onClick={() => onFiltersChange({
              ...filters,
              position: undefined,
              team: undefined,
              search: undefined,
              page: 1,
            })}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
