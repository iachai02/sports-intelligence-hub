import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, AlertCircle, BarChart3 } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import type { PlayerStats as PlayerStatsType, PlayerStatsFilters } from '../lib/types';
import { getPlayers, getPlayer, getTeams, comparePlayers } from '../lib/playerStatsApi';
import {
  PlayerStatsFiltersPanel,
  PlayerStatsTable,
  PlayerDetailModal,
  PlayerComparisonView,
} from '../components/player-stats';
import { cn } from '../lib/utils';

const DEFAULT_FILTERS: PlayerStatsFilters = {
  sortBy: 'auction_value',
  sortOrder: 'desc',
  page: 1,
  perPage: 50,
};

export function PlayerStats() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse URL params into filters
  const getFiltersFromUrl = useCallback((): PlayerStatsFilters => {
    return {
      search: searchParams.get('search') || undefined,
      position: searchParams.get('position') || undefined,
      team: searchParams.get('team') || undefined,
      sortBy: searchParams.get('sortBy') || DEFAULT_FILTERS.sortBy,
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || DEFAULT_FILTERS.sortOrder,
      page: parseInt(searchParams.get('page') || '1', 10),
      perPage: parseInt(searchParams.get('perPage') || '50', 10),
    };
  }, [searchParams]);

  const [filters, setFilters] = useState<PlayerStatsFilters>(getFiltersFromUrl);
  const [players, setPlayers] = useState<PlayerStatsType[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [teams, setTeams] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStatsType | null>(null);

  // Comparison state
  const [comparePlayerIds, setComparePlayerIds] = useState<string[]>(() => {
    const ids = searchParams.get('compare');
    return ids ? ids.split(',').filter(Boolean) : [];
  });
  const [comparePlayers_, setComparePlayers] = useState<PlayerStatsType[]>([]);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.search) params.set('search', filters.search);
    if (filters.position) params.set('position', filters.position);
    if (filters.team) params.set('team', filters.team);
    if (filters.sortBy !== DEFAULT_FILTERS.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortOrder !== DEFAULT_FILTERS.sortOrder) params.set('sortOrder', filters.sortOrder);
    if (filters.page !== 1) params.set('page', filters.page.toString());
    if (filters.perPage !== 50) params.set('perPage', filters.perPage.toString());
    if (comparePlayerIds.length > 0) params.set('compare', comparePlayerIds.join(','));

    setSearchParams(params, { replace: true });
  }, [filters, comparePlayerIds, setSearchParams]);

  // Load teams on mount
  useEffect(() => {
    getTeams()
      .then(setTeams)
      .catch((err) => console.error('Failed to load teams:', err));
  }, []);

  // Load players when filters change
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    getPlayers(filters)
      .then((response) => {
        setPlayers(response.players);
        setTotalPages(response.total_pages);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load players');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [filters]);

  // Load selected player details
  useEffect(() => {
    if (!selectedPlayerId) {
      setSelectedPlayer(null);
      return;
    }

    getPlayer(selectedPlayerId)
      .then(setSelectedPlayer)
      .catch((err) => {
        console.error('Failed to load player:', err);
        setSelectedPlayerId(null);
      });
  }, [selectedPlayerId]);

  // Load comparison players
  useEffect(() => {
    if (comparePlayerIds.length === 0) {
      setComparePlayers([]);
      return;
    }

    comparePlayers(comparePlayerIds)
      .then((response) => setComparePlayers(response.players))
      .catch((err) => console.error('Failed to load comparison:', err));
  }, [comparePlayerIds]);

  const handleFiltersChange = (newFilters: PlayerStatsFilters) => {
    setFilters(newFilters);
  };

  const handleToggleCompare = (playerId: string) => {
    setComparePlayerIds((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, playerId];
    });
  };

  const handleRemoveFromCompare = (playerId: string) => {
    setComparePlayerIds((prev) => prev.filter((id) => id !== playerId));
  };

  const handleClearCompare = () => {
    setComparePlayerIds([]);
  };

  const handleAddToCompare = (playerId: string) => {
    if (!comparePlayerIds.includes(playerId) && comparePlayerIds.length < 3) {
      setComparePlayerIds((prev) => [...prev, playerId]);
    }
    setSelectedPlayerId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className={cn(
        'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8',
        comparePlayers_.length > 0 && 'pb-80' // Add padding for comparison panel
      )}>
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
            <ThemeToggle />
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Player Stats</h1>
              <p className="text-muted-foreground mt-1">
                Browse, search, and compare NBA player statistics
              </p>
            </div>
          </div>
        </motion.header>

        {/* Filters */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <PlayerStatsFiltersPanel
            filters={filters}
            onFiltersChange={handleFiltersChange}
            teams={teams}
            onSelectPlayer={setSelectedPlayerId}
          />
        </motion.section>

        {/* Error state */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-stat-negative/10 border border-stat-negative/20 rounded-xl p-4 mb-6 flex items-start gap-3"
          >
            <AlertCircle className="h-5 w-5 text-stat-negative shrink-0 mt-0.5" />
            <div>
              <p className="text-foreground font-medium">Failed to load players</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <button
                onClick={() => setFilters({ ...filters })}
                className="text-sm text-accent hover:underline mt-2"
              >
                Try again
              </button>
            </div>
          </motion.div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center"
          >
            <Loader2 className="h-8 w-8 text-accent animate-spin mb-4" />
            <p className="text-muted-foreground">Loading players...</p>
          </motion.div>
        ) : (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <PlayerStatsTable
              players={players}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              selectedPlayerIds={comparePlayerIds}
              onToggleSelect={handleToggleCompare}
              onRowClick={setSelectedPlayerId}
              totalPages={totalPages}
              isLoading={isLoading}
            />
          </motion.section>
        )}
      </div>

      {/* Sticky comparison panel */}
      <PlayerComparisonView
        players={comparePlayers_}
        onRemovePlayer={handleRemoveFromCompare}
        onClearAll={handleClearCompare}
      />

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayerId(null)}
          onAddToCompare={handleAddToCompare}
          isInCompare={selectedPlayerId ? comparePlayerIds.includes(selectedPlayerId) : false}
        />
      )}
    </div>
  );
}
