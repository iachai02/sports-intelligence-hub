import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, X, Plus } from 'lucide-react';
import type { PlayerSearchResult } from '../../lib/types';
import { PositionBadge } from './PositionBadge';
import { cn } from '../../lib/utils';

interface GlobalSearchBarProps {
  onSearch: (query: string, signal?: AbortSignal) => Promise<PlayerSearchResult[]>;
  onPlayerClick: (player: PlayerSearchResult) => void;
  onReportPick: (player: PlayerSearchResult) => void;
}

export function GlobalSearchBar({
  onSearch,
  onPlayerClick,
  onReportPick,
}: GlobalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsSearching(true);

      try {
        const searchResults = await onSearch(searchQuery, controller.signal);
        if (!controller.signal.aborted) {
          setResults(searchResults);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    },
    [onSearch],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    debounceRef.current = setTimeout(() => performSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Close on outside click
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
    <div ref={containerRef} className="relative max-w-md">
      <div
        className={cn(
          'relative flex items-center border rounded-xl transition-all h-9',
          isFocused
            ? 'border-accent/50 ring-2 ring-accent/10 bg-card'
            : 'border-border bg-muted/40',
        )}
      >
        <Search className="h-4 w-4 text-muted-foreground absolute left-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Search for any player..."
          className="w-full pl-9 pr-8 py-1.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground rounded-xl outline-none"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {isSearching && (
            <Loader2 className="h-3.5 w-3.5 text-accent animate-spin" />
          )}
          {query.length > 0 && !isSearching && (
            <button
              onClick={clearSearch}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Floating dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto min-w-[320px]"
          >
            {results.length > 0 ? (
              results.map((player) => (
                <div
                  key={player.player_id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 border-b border-border/50 last:border-b-0 transition-colors',
                    !player.is_available
                      ? 'opacity-50 bg-muted/30'
                      : 'hover:bg-muted/40',
                  )}
                >
                  {/* Clickable player info */}
                  <button
                    onClick={() => {
                      onPlayerClick(player);
                      setIsFocused(false);
                    }}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <PositionBadge position={player.position} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">
                        {player.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {player.team} &middot; {player.projected_fpts.toFixed(1)} FPTS &middot; ${player.auction_value}
                      </span>
                    </div>
                  </button>

                  {/* Availability & Report Pick button */}
                  {player.is_available ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReportPick(player);
                        setIsFocused(false);
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors shrink-0"
                      title="Report Pick"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <span className="text-[10px] text-stat-negative font-medium shrink-0">
                      Taken
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-muted-foreground">No players found</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
