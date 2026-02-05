import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, X } from 'lucide-react';
import type { PlayerSearchResult } from '../../lib/types';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';
import { AnimatedCard } from './AnimatedCard';
import { PositionBadge } from './PositionBadge';
import { cn } from '../../lib/utils';

interface PlayerSearchProps {
  onSearch: (query: string, signal?: AbortSignal) => Promise<PlayerSearchResult[]>;
  onDraft: (playerId: string, cost: number) => void;
  onMarkTaken: (playerId: string) => void;
  budgetRemaining: number;
}

export function PlayerSearch({
  onSearch,
  onDraft,
  onMarkTaken,
  budgetRemaining,
}: PlayerSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [draftCost, setDraftCost] = useState<Record<string, number>>({});
  const [isFocused, setIsFocused] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search function
  const performSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsSearching(true);
    try {
      const searchResults = await onSearch(searchQuery, signal);
      if (!signal.aborted) {
        setResults(searchResults);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Search failed:', error);
    } finally {
      if (!signal.aborted) {
        setIsSearching(false);
      }
    }
  }, 300);

  // Trigger search when query changes
  useEffect(() => {
    if (query.length >= 2) {
      performSearch(query);
    } else {
      setResults([]);
      setIsSearching(false);
    }
  }, [query, performSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clearSearch = () => {
    setQuery('');
    setResults([]);
  };

  const showDropdown = isFocused && (results.length > 0 || (query.length >= 2 && !isSearching));

  return (
    <AnimatedCard className="p-5" delay={0.2}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Search className="h-4 w-4 text-accent" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Search Players</h3>
      </div>

      {/* Search input */}
      <div ref={containerRef} className="relative">
        <div
          className={cn(
            'relative flex items-center border rounded-xl transition-all',
            isFocused
              ? 'border-accent/50 ring-2 ring-accent/10'
              : 'border-border',
          )}
        >
          <Search className="h-4 w-4 text-muted-foreground absolute left-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Search by name..."
            className="w-full pl-9 pr-9 py-2.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground rounded-xl outline-none"
          />
          <div className="absolute right-3 flex items-center gap-1.5">
            {isSearching && (
              <Loader2 className="h-4 w-4 text-accent animate-spin" />
            )}
            {query.length > 0 && !isSearching && (
              <button
                onClick={clearSearch}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Floating dropdown results */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-soft overflow-hidden max-h-80 overflow-y-auto"
            >
              {results.length > 0 ? (
                results.map((player, index) => (
                  <motion.div
                    key={player.player_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      'px-3 py-2.5 border-b border-border/50 last:border-b-0 transition-colors',
                      !player.is_available
                        ? 'opacity-50 bg-muted/30'
                        : 'hover:bg-muted/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <PositionBadge position={player.position} />
                          <span className="font-medium text-foreground text-sm truncate">
                            {player.name}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {player.team}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 ml-[38px] tabular-nums">
                          {player.projected_fpts.toFixed(1)} FPTS &middot; ${player.auction_value}
                        </div>
                      </div>

                      {player.is_available ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={1}
                            max={budgetRemaining}
                            value={draftCost[player.player_id] ?? player.auction_value}
                            onChange={(e) =>
                              setDraftCost((prev) => ({
                                ...prev,
                                [player.player_id]: Number(e.target.value),
                              }))
                            }
                            className="w-12 px-1.5 py-1 border border-border rounded-lg text-center text-xs bg-background text-foreground tabular-nums"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={() => {
                              const cost = draftCost[player.player_id] ?? player.auction_value;
                              onDraft(player.player_id, cost);
                              setResults((prev) =>
                                prev.map((p) =>
                                  p.player_id === player.player_id
                                    ? { ...p, is_available: false }
                                    : p
                                )
                              );
                            }}
                            disabled={(draftCost[player.player_id] ?? player.auction_value) > budgetRemaining}
                            className={cn(
                              'px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all',
                              'bg-accent text-accent-foreground hover:bg-accent/90',
                              'disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed',
                            )}
                          >
                            Draft
                          </button>
                          <button
                            onClick={() => {
                              onMarkTaken(player.player_id);
                              setResults((prev) =>
                                prev.map((p) =>
                                  p.player_id === player.player_id
                                    ? { ...p, is_available: false }
                                    : p
                                )
                              );
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            Taken
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Unavailable</span>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="px-3 py-6 text-center">
                  <p className="text-sm text-muted-foreground">No players found</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recent results shown below when dropdown is closed */}
      {!isFocused && results.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-1.5"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-muted-foreground font-medium">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={clearSearch}
              className="text-[11px] text-accent hover:text-accent/80 transition-colors"
            >
              Clear
            </button>
          </div>
          {results.map((player, index) => (
            <motion.div
              key={player.player_id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              className={cn(
                'flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/60 transition-colors',
                !player.is_available ? 'opacity-50 bg-muted/20' : 'hover:border-accent/30',
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <PositionBadge position={player.position} />
                <span className="font-medium text-foreground text-sm truncate">{player.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{player.team}</span>
              </div>

              {player.is_available ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min={1}
                    max={budgetRemaining}
                    value={draftCost[player.player_id] ?? player.auction_value}
                    onChange={(e) =>
                      setDraftCost((prev) => ({
                        ...prev,
                        [player.player_id]: Number(e.target.value),
                      }))
                    }
                    className="w-12 px-1.5 py-1 border border-border rounded-lg text-center text-xs bg-background text-foreground tabular-nums"
                  />
                  <button
                    onClick={() => {
                      const cost = draftCost[player.player_id] ?? player.auction_value;
                      onDraft(player.player_id, cost);
                      setResults((prev) =>
                        prev.map((p) =>
                          p.player_id === player.player_id
                            ? { ...p, is_available: false }
                            : p
                        )
                      );
                    }}
                    disabled={(draftCost[player.player_id] ?? player.auction_value) > budgetRemaining}
                    className={cn(
                      'px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all',
                      'bg-accent text-accent-foreground hover:bg-accent/90',
                      'disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed',
                    )}
                  >
                    Draft
                  </button>
                  <button
                    onClick={() => {
                      onMarkTaken(player.player_id);
                      setResults((prev) =>
                        prev.map((p) =>
                          p.player_id === player.player_id
                            ? { ...p, is_available: false }
                            : p
                        )
                      );
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    Taken
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground italic">Unavailable</span>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatedCard>
  );
}
