import { useState, useCallback } from 'react';
import {
  getDraftState,
  draftPlayer,
  markPlayerTaken,
  getCategoryRecommendations,
  searchPlayers,
  undoLastAction,
  skipPlayer,
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
import { SessionPicker } from '../components/draft-room/SessionPicker';
import { ThemeToggle } from '../components/ThemeToggle';
import { AuthButton } from '../components/AuthButton';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_FILTERS: RecommendationFilters = {
  scoringMode: 'balanced',
  affordability: [],
};

export function DraftRoom() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [rosterAnalysis, setRosterAnalysis] = useState<RosterCategoryAnalysis | null>(null);
  const [fillGapRecs, setFillGapRecs] = useState<CategoryAwareRecommendation[]>([]);
  const [reinforceRecs, setReinforceRecs] = useState<CategoryAwareRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state (skipped players now persisted via API)
  const [filters, setFilters] = useState<RecommendationFilters>(DEFAULT_FILTERS);
  const [skippedCount, setSkippedCount] = useState(0);

  // Refresh state and recommendations
  const refreshState = useCallback(async (sid: number, currentFilters: RecommendationFilters) => {
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

  // Select session (from session picker or create)
  const handleSelectSession = async (sid: number) => {
    setIsLoading(true);
    setError(null);
    setFilters(DEFAULT_FILTERS);
    setSkippedCount(0);
    try {
      setSessionId(sid);
      await refreshState(sid, DEFAULT_FILTERS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  // Draft a player
  const handleDraft = async (playerId: string, cost: number) => {
    if (!sessionId) return;
    try {
      await draftPlayer(sessionId, playerId, cost);
      await refreshState(sessionId, filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to draft player');
    }
  };

  // Mark player as taken
  const handleMarkTaken = async (playerId: string) => {
    if (!sessionId) return;
    try {
      await markPlayerTaken(sessionId, playerId);
      await refreshState(sessionId, filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark player taken');
    }
  };

  // Skip a player (now persisted via API)
  const handleSkip = async (playerId: string) => {
    if (!sessionId) return;
    try {
      await skipPlayer(sessionId, playerId);
      setSkippedCount(prev => prev + 1);
      await refreshState(sessionId, filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip player');
    }
  };

  // Clear skipped is no longer a simple reset since skips are persisted.
  // For now, we just note that skipped players are managed server-side.
  const handleClearSkipped = () => {
    // Skipped players are persisted in the DB.
    // A full "clear" would need an API endpoint.
    // For now, just reset the counter display.
    setSkippedCount(0);
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters: RecommendationFilters) => {
    setFilters(newFilters);
    if (sessionId) {
      refreshState(sessionId, newFilters);
    }
  };

  // Undo last action
  const handleUndo = async () => {
    if (!sessionId) return;
    try {
      await undoLastAction(sessionId);
      await refreshState(sessionId, filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo');
    }
  };

  // Search players
  const handleSearch = async (query: string, signal?: AbortSignal): Promise<PlayerSearchResult[]> => {
    if (!sessionId) return [];
    return searchPlayers(sessionId, query, false, signal);
  };

  // Back to session picker
  const handleBackToSessions = () => {
    setSessionId(null);
    setDraftState(null);
    setRosterAnalysis(null);
    setFillGapRecs([]);
    setReinforceRecs([]);
    setFilters(DEFAULT_FILTERS);
    setSkippedCount(0);
    setError(null);
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Not authenticated - show sign in prompt
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="absolute top-4 right-4 flex items-center gap-3">
          <AuthButton />
          <ThemeToggle />
        </div>
        <div className="bg-card border border-border p-8 rounded-lg shadow-lg text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-foreground">Fantasy Draft Room</h1>
          <p className="text-muted-foreground mb-6">
            Sign in to access the Draft Room. Your sessions are saved so you can
            resume anytime.
          </p>
          <AuthButton />
        </div>
      </div>
    );
  }

  // Authenticated but no session selected - show session picker
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-foreground">Fantasy Draft Room</h1>
            <div className="flex items-center gap-3">
              <AuthButton />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <SessionPicker onSelectSession={handleSelectSession} />
          {isLoading && (
            <div className="text-center text-muted-foreground mt-4">Loading session...</div>
          )}
          {error && (
            <div className="bg-stat-negative/10 border-l-4 border-stat-negative p-4 mt-4">
              <p className="text-stat-negative">{error}</p>
            </div>
          )}
        </main>
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
                {draftState.players_available} available &middot; {draftState.players_taken_by_others} taken
              </span>
            )}
            <button
              onClick={handleBackToSessions}
              className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded text-foreground transition-colors"
            >
              Sessions
            </button>
            <AuthButton />
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
                skippedCount={skippedCount}
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
