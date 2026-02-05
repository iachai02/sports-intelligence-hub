import { useState, useEffect, useRef } from 'react';
import type { PlayerSearchResult } from '../../lib/types';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';

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
  const abortControllerRef = useRef<AbortController | null>(null);

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
      // Only update if not aborted
      if (!signal.aborted) {
        setResults(searchResults);
      }
    } catch (error) {
      // Ignore abort errors
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

  return (
    <div className="bg-card border border-border rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Search Players</h3>

      {/* Search input */}
      <div className="relative mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name..."
          className="w-full px-3 py-2 border border-border rounded pr-10 bg-background text-foreground placeholder:text-muted-foreground"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {results.map((player) => (
          <div
            key={player.player_id}
            className={`p-3 border border-border rounded flex justify-between items-center ${
              !player.is_available ? 'bg-muted/50 opacity-60' : 'hover:border-accent/50'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{player.name}</span>
                <span className="text-sm text-muted-foreground">{player.team}</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  {player.position}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {player.projected_fpts.toFixed(1)} FPTS • ${player.auction_value}
              </div>
            </div>

            {player.is_available ? (
              <div className="flex items-center gap-2">
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
                  className="w-16 px-2 py-1 border border-border rounded text-center text-sm bg-background text-foreground"
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
                  className="px-3 py-1 text-sm bg-accent text-accent-foreground rounded hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground transition-colors"
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
                  className="px-3 py-1 text-sm bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
                >
                  Taken
                </button>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Unavailable</span>
            )}
          </div>
        ))}

        {results.length === 0 && query.length >= 2 && !isSearching && (
          <p className="text-muted-foreground text-center py-4">No players found</p>
        )}
      </div>
    </div>
  );
}
