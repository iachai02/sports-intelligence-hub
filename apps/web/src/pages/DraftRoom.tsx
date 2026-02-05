import { useState, useCallback } from 'react';
import {
  createDraftSession,
  getDraftState,
  draftPlayer,
  markPlayerTaken,
  getCategoryRecommendations,
  searchPlayers,
  undoLastAction,
} from '../lib/api';
import type {
  DraftState,
  CategoryAwareRecommendation,
  RosterCategoryAnalysis,
  PlayerSearchResult,
} from '../lib/types';
import { BudgetTracker } from '../components/draft-room/BudgetTracker';
import { MyRoster } from '../components/draft-room/MyRoster';
import { RecommendationsPanel, type RecommendationFilters } from '../components/draft-room/RecommendationsPanel';
import { PlayerSearch } from '../components/draft-room/PlayerSearch';
import { TakenPlayersPanel } from '../components/draft-room/TakenPlayersPanel';
import { ThemeToggle } from '../components/ThemeToggle';

const DEFAULT_FILTERS: RecommendationFilters = {
  scoringMode: 'balanced',
  affordability: [],
};

export function DraftRoom() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [rosterAnalysis, setRosterAnalysis] = useState<RosterCategoryAnalysis | null>(null);
  const [fillGapRecs, setFillGapRecs] = useState<CategoryAwareRecommendation[]>([]);
  const [reinforceRecs, setReinforceRecs] = useState<CategoryAwareRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter and skip state
  const [filters, setFilters] = useState<RecommendationFilters>(DEFAULT_FILTERS);
  const [skippedPlayerIds, setSkippedPlayerIds] = useState<Set<string>>(new Set());

  // Refresh state and recommendations
  const refreshState = useCallback(async (sid: string, currentFilters: RecommendationFilters, currentSkipped: Set<string>) => {
    try {
      const [state, catRecs] = await Promise.all([
        getDraftState(sid),
        getCategoryRecommendations(sid, 10, {
          position: currentFilters.position,
          scoringMode: currentFilters.scoringMode,
          minCost: currentFilters.minCost,
          maxCost: currentFilters.maxCost,
          minFpts: currentFilters.minFpts,
          maxFpts: currentFilters.maxFpts,
          affordability: currentFilters.affordability.length > 0 ? currentFilters.affordability : undefined,
          skippedIds: currentSkipped.size > 0 ? Array.from(currentSkipped) : undefined,
        }),
      ]);
      setDraftState(state);
      setRosterAnalysis(catRecs.roster_analysis);
      setFillGapRecs(catRecs.fill_gap_recommendations);
      setReinforceRecs(catRecs.reinforce_recommendations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh state');
    }
  }, []);

  // Create new session
  const handleCreateSession = async () => {
    setIsLoading(true);
    setError(null);
    // Reset filters and skipped on new session
    setFilters(DEFAULT_FILTERS);
    setSkippedPlayerIds(new Set());
    try {
      const session = await createDraftSession(12, 200);
      setSessionId(session.session_id);
      await refreshState(session.session_id, DEFAULT_FILTERS, new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setIsLoading(false);
    }
  };

  // Draft a player
  const handleDraft = async (playerId: string, cost: number) => {
    if (!sessionId) return;
    try {
      await draftPlayer(sessionId, playerId, cost);
      // Remove from skipped if they were skipped
      const newSkipped = new Set(skippedPlayerIds);
      newSkipped.delete(playerId);
      setSkippedPlayerIds(newSkipped);
      await refreshState(sessionId, filters, newSkipped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to draft player');
    }
  };

  // Mark player as taken
  const handleMarkTaken = async (playerId: string) => {
    if (!sessionId) return;
    try {
      await markPlayerTaken(sessionId, playerId);
      // Remove from skipped if they were skipped
      const newSkipped = new Set(skippedPlayerIds);
      newSkipped.delete(playerId);
      setSkippedPlayerIds(newSkipped);
      await refreshState(sessionId, filters, newSkipped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark player taken');
    }
  };

  // Skip a player (hide from recommendations this session)
  const handleSkip = (playerId: string) => {
    const newSkipped = new Set(skippedPlayerIds);
    newSkipped.add(playerId);
    setSkippedPlayerIds(newSkipped);
    // Refresh recommendations with new skipped list
    if (sessionId) {
      refreshState(sessionId, filters, newSkipped);
    }
  };

  // Clear all skipped players
  const handleClearSkipped = () => {
    setSkippedPlayerIds(new Set());
    if (sessionId) {
      refreshState(sessionId, filters, new Set());
    }
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters: RecommendationFilters) => {
    setFilters(newFilters);
    if (sessionId) {
      refreshState(sessionId, newFilters, skippedPlayerIds);
    }
  };

  // Undo last action
  const handleUndo = async () => {
    if (!sessionId) return;
    try {
      await undoLastAction(sessionId);
      await refreshState(sessionId, filters, skippedPlayerIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo');
    }
  };

  // Search players
  const handleSearch = async (query: string, signal?: AbortSignal): Promise<PlayerSearchResult[]> => {
    if (!sessionId) return [];
    return searchPlayers(sessionId, query, false, signal);
  };

  // Show create session screen if no session
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="bg-card border border-border p-8 rounded-lg shadow-lg text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-foreground">Fantasy Draft Room</h1>
          <p className="text-muted-foreground mb-6">
            Start a new draft session to get real-time pick recommendations
            based on player projections and your roster needs.
          </p>
          <button
            onClick={handleCreateSession}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground font-semibold transition-colors"
          >
            {isLoading ? 'Creating Session...' : 'Start Draft Session'}
          </button>
          {error && (
            <p className="mt-4 text-stat-negative">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // Main draft room UI
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-foreground">Fantasy Draft Room</h1>
          <div className="flex items-center gap-4">
            {draftState && (
              <span className="text-sm text-muted-foreground">
                {draftState.players_available} available • {draftState.players_taken_by_others} taken
              </span>
            )}
            <button
              onClick={handleCreateSession}
              className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded text-foreground transition-colors"
            >
              New Session
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-stat-negative/10 border-l-4 border-stat-negative p-4 mx-4 mt-4">
          <p className="text-stat-negative">{error}</p>
        </div>
      )}

      {/* Main content */}
      {draftState && (
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: My Roster + Budget + Taken Players */}
            <div className="space-y-6">
              <BudgetTracker
                remaining={draftState.budget_remaining}
                total={draftState.budget_total}
                spotsRemaining={draftState.roster_spots_remaining}
              />
              <MyRoster
                roster={draftState.my_roster}
                slotsNeeded={draftState.slots_needed}
                onUndo={handleUndo}
              />
              <TakenPlayersPanel takenPlayers={draftState.taken_players} />
            </div>

            {/* Center column: Category-Aware Recommendations */}
            <div>
              <RecommendationsPanel
                rosterAnalysis={rosterAnalysis}
                fillGapRecommendations={fillGapRecs}
                reinforceRecommendations={reinforceRecs}
                onDraft={handleDraft}
                onMarkTaken={handleMarkTaken}
                onSkip={handleSkip}
                budgetRemaining={draftState.budget_remaining}
                filters={filters}
                onFiltersChange={handleFiltersChange}
                skippedCount={skippedPlayerIds.size}
                onClearSkipped={handleClearSkipped}
              />
            </div>

            {/* Right column: Player Search */}
            <div>
              <PlayerSearch
                onSearch={handleSearch}
                onDraft={handleDraft}
                onMarkTaken={handleMarkTaken}
                budgetRemaining={draftState.budget_remaining}
              />
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
