import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, LayoutGrid, Users, Sparkles, ClipboardList, Plus } from 'lucide-react';
import {
  getDraftState,
  draftPlayer,
  markPlayerTaken,
  getCategoryRecommendations,
  searchPlayers,
  undoLastAction,
  skipPlayer,
  getRoomDetails,
  getRoomState,
  getBoardState,
  getRoomActivity,
  reportPick,
  undoRoomPick,
  getRoomRecommendations,
  searchRoomPlayers,
  updateDraftSession,
} from '../lib/api';
import type {
  DraftState,
  CategoryAwareRecommendation,
  RosterCategoryAnalysis,
  PlayerSearchResult,
  RoomDetails,
  BoardState,
  ActivityLogEntry,
  WsMessage,
  WsPickReported,
  WsPickUndone,
  WsMemberEvent,
} from '../lib/types';
import { BudgetTracker } from '../components/draft-room/BudgetTracker';
import { MyRoster } from '../components/draft-room/MyRoster';
import { RecommendationsPanel, type RecommendationFilters } from '../components/draft-room/RecommendationsPanel';
import { TakenPlayersPanel } from '../components/draft-room/TakenPlayersPanel';
import { SessionPicker } from '../components/draft-room/SessionPicker';
import { RoomLobby } from '../components/draft-room/RoomLobby';
import { RoomWaitingScreen } from '../components/draft-room/RoomWaitingScreen';
import { RoomHeader } from '../components/draft-room/RoomHeader';
import { DraftBoard } from '../components/draft-room/DraftBoard';
import { ActivityFeed } from '../components/draft-room/ActivityFeed';
import { ReportPickModal } from '../components/draft-room/ReportPickModal';
import { GlobalSearchBar } from '../components/draft-room/GlobalSearchBar';
import { DraftPlayerDetailModal } from '../components/draft-room/DraftPlayerDetailModal';
import { AuthButton } from '../components/AuthButton';
import { useAuth } from '../contexts/AuthContext';
import { useRoomWebSocket } from '../hooks/useRoomWebSocket';
import { cn } from '../lib/utils';

type DraftTab = 'board' | 'team' | 'recommendations';
type PageView = 'lobby' | 'waiting' | 'legacy-picker' | 'draft';

const TABS: { id: DraftTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'board', label: 'Draft Board', icon: LayoutGrid },
  { id: 'team', label: 'My Team', icon: Users },
  { id: 'recommendations', label: 'Recommendations', icon: Sparkles },
];

const DEFAULT_FILTERS: RecommendationFilters = {
  scoringMode: 'balanced',
  affordability: [],
};

export function DraftRoom() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const location = useLocation();

  // Resolve room to restore: location.state (from dashboard) > sessionStorage
  const [restoredRoomId] = useState<number | null>(() => {
    const stateRoom = (location.state as { roomId?: number } | null)?.roomId;
    if (stateRoom) return stateRoom;
    const stored = sessionStorage.getItem('draft-room-id');
    if (stored && !Number.isNaN(Number(stored))) return Number(stored);
    return null;
  });

  // Navigation state - skip lobby if restoring a room
  const [pageView, setPageView] = useState<PageView>(restoredRoomId ? 'draft' : 'lobby');
  const [roomId, setRoomId] = useState<number | null>(restoredRoomId);

  // Room state
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [boardState, setBoardState] = useState<BoardState | null>(null);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [reportPickOpen, setReportPickOpen] = useState(false);
  const [reportPickPreselect, setReportPickPreselect] = useState<PlayerSearchResult | null>(null);

  // Player detail modal state
  const [detailPlayer, setDetailPlayer] = useState<PlayerSearchResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Legacy session state (for backward compatibility)
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [rosterAnalysis, setRosterAnalysis] = useState<RosterCategoryAnalysis | null>(null);
  const [fillGapRecs, setFillGapRecs] = useState<CategoryAwareRecommendation[]>([]);
  const [reinforceRecs, setReinforceRecs] = useState<CategoryAwareRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(restoredRoomId !== null);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<DraftTab>('board');
  const [showActivity, setShowActivity] = useState(true);

  // Filter state
  const [filters, setFilters] = useState<RecommendationFilters>(DEFAULT_FILTERS);
  const [skippedCount, setSkippedCount] = useState(0);

  const isRoomMode = roomId !== null;
  const myMemberId = room?.members.find(
    (m) => m.user_id === user?.id && !m.is_phantom
  )?.id ?? null;
  const isCommissioner = room?.commissioner_id === user?.id;

  // --- Room data loading ---
  const refreshRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const details = await getRoomDetails(roomId);
      setRoom(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room');
    }
  }, [roomId]);

  const refreshBoard = useCallback(async () => {
    if (!roomId) return;
    try {
      const board = await getBoardState(roomId);
      setBoardState(board);
    } catch {
      // Board may not be available in waiting state
    }
  }, [roomId]);

  const refreshActivities = useCallback(async () => {
    if (!roomId) return;
    try {
      const logs = await getRoomActivity(roomId);
      setActivities(logs);
    } catch {
      // Activities may fail silently
    }
  }, [roomId]);

  // --- Refresh functions ---
  const refreshRoomState = useCallback(async (sid: number, currentFilters: RecommendationFilters) => {
    try {
      const [state, catRecs] = await Promise.all([
        getRoomState(sid),
        getRoomRecommendations(sid, 10, {
          position: currentFilters.position,
          scoringMode: currentFilters.scoringMode,
          minCost: currentFilters.minCost,
          maxCost: currentFilters.maxCost,
          minFpts: currentFilters.minFpts,
          maxFpts: currentFilters.maxFpts,
          affordability: currentFilters.affordability?.length ? currentFilters.affordability : undefined,
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

  const refreshLegacyState = useCallback(async (sid: number, currentFilters: RecommendationFilters) => {
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
          affordability: currentFilters.affordability?.length ? currentFilters.affordability : undefined,
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

  const refreshState = isRoomMode ? refreshRoomState : refreshLegacyState;
  const currentSessionId = isRoomMode ? roomId : sessionId;

  // --- WebSocket ---
  const handleWsMessage = useCallback((message: WsMessage) => {
    switch (message.type) {
      case 'pick_reported': {
        const pick = message as WsPickReported;
        setActivities((prev) => [
          {
            id: Date.now(),
            action_type: 'pick_reported',
            payload: { player_name: pick.player_name, team_name: pick.team_name, price: pick.price },
            user_name: pick.reported_by,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        if (roomId) {
          refreshRoomState(roomId, filters);
          refreshBoard();
        }
        break;
      }
      case 'pick_undone': {
        const undo = message as WsPickUndone;
        setActivities((prev) => [
          {
            id: Date.now(),
            action_type: 'pick_undone',
            payload: { player_name: undo.player_name, team_name: undo.team_name },
            user_name: undo.undone_by,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        if (roomId) {
          refreshRoomState(roomId, filters);
          refreshBoard();
        }
        break;
      }
      case 'member_joined':
      case 'member_left': {
        const evt = message as WsMemberEvent;
        setActivities((prev) => [
          {
            id: Date.now(),
            action_type: evt.type,
            payload: { user_name: evt.user_name },
            user_name: evt.user_name,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        refreshRoom();
        break;
      }
      case 'member_connected':
      case 'member_disconnected':
        refreshRoom();
        break;
    }
  }, [roomId, filters, refreshRoomState, refreshBoard, refreshRoom]);

  const { status: wsStatus } = useRoomWebSocket({
    roomId: isRoomMode && room?.status === 'active' ? roomId : null,
    onMessage: handleWsMessage,
  });

  // --- Room selection ---
  const handleSelectRoom = async (selectedRoomId: number) => {
    setIsLoading(true);
    setError(null);
    setFilters(DEFAULT_FILTERS);
    setSkippedCount(0);
    setRoomId(selectedRoomId);
    sessionStorage.setItem('draft-room-id', String(selectedRoomId));

    try {
      const details = await getRoomDetails(selectedRoomId);
      setRoom(details);

      if (details.status === 'waiting') {
        setPageView('waiting');
      } else {
        setPageView('draft');
        await Promise.all([
          refreshRoomState(selectedRoomId, DEFAULT_FILTERS),
          getBoardState(selectedRoomId).then(setBoardState).catch(() => {}),
          getRoomActivity(selectedRoomId).then(setActivities).catch(() => {}),
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartDraft = async () => {
    if (!roomId) return;
    setIsLoading(true);
    try {
      await updateDraftSession(roomId, { status: 'active' });
      await refreshRoom();
      setPageView('draft');
      await Promise.all([
        refreshRoomState(roomId, DEFAULT_FILTERS),
        getBoardState(roomId).then(setBoardState).catch(() => {}),
        getRoomActivity(roomId).then(setActivities).catch(() => {}),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start draft');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Legacy session selection (backward compat) ---
  const handleSelectSession = async (sid: number) => {
    setIsLoading(true);
    setError(null);
    setFilters(DEFAULT_FILTERS);
    setSkippedCount(0);
    try {
      setSessionId(sid);
      setPageView('draft');
      await refreshLegacyState(sid, DEFAULT_FILTERS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Draft actions ---
  const handleDraft = async (playerId: string, cost: number) => {
    if (!currentSessionId) return;
    try {
      if (isRoomMode) {
        if (!myMemberId) return;
        await reportPick(currentSessionId, playerId, myMemberId, cost);
        await refreshRoomState(currentSessionId, filters);
        await refreshBoard();
      } else {
        await draftPlayer(currentSessionId, playerId, cost);
        await refreshLegacyState(currentSessionId, filters);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to draft player');
    }
  };

  const handleMarkTaken = async (playerId: string) => {
    if (!currentSessionId) return;
    try {
      await markPlayerTaken(currentSessionId, playerId);
      await refreshState(currentSessionId, filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark player taken');
    }
  };

  const handleSkip = async (playerId: string) => {
    if (!currentSessionId) return;
    try {
      await skipPlayer(currentSessionId, playerId);
      setSkippedCount(prev => prev + 1);
      await refreshState(currentSessionId, filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip player');
    }
  };

  const handleClearSkipped = () => {
    setSkippedCount(0);
  };

  const handleFiltersChange = (newFilters: RecommendationFilters) => {
    setFilters(newFilters);
    if (currentSessionId) {
      refreshState(currentSessionId, newFilters);
    }
  };

  const handleUndo = async () => {
    if (!currentSessionId) return;
    try {
      if (isRoomMode) {
        await undoRoomPick(currentSessionId);
        await refreshRoomState(currentSessionId, filters);
        await refreshBoard();
      } else {
        await undoLastAction(currentSessionId);
        await refreshLegacyState(currentSessionId, filters);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo');
    }
  };

  const handleSearch = async (query: string, signal?: AbortSignal): Promise<PlayerSearchResult[]> => {
    if (!currentSessionId) return [];
    if (isRoomMode) {
      return searchRoomPlayers(currentSessionId, query, true, signal);
    }
    return searchPlayers(currentSessionId, query, true, signal);
  };

  const handleBoardPlayerClick = async (playerId: string) => {
    if (!currentSessionId) return;
    try {
      const searchFn = isRoomMode ? searchRoomPlayers : searchPlayers;
      const results = await searchFn(currentSessionId, playerId, true);
      const match = results.find((p) => p.player_id === playerId);
      if (match) {
        handleOpenPlayerDetail(match);
      }
    } catch {
      // Silently fail - player detail is non-critical
    }
  };

  const handleOpenPlayerDetail = (player: PlayerSearchResult) => {
    setDetailPlayer(player);
    setDetailOpen(true);
  };

  const handleReportPickFromDetail = (player: PlayerSearchResult) => {
    setDetailOpen(false);
    setReportPickPreselect(player);
    setReportPickOpen(true);
  };

  const handleReportPickFromSearch = (player: PlayerSearchResult) => {
    setReportPickPreselect(player);
    setReportPickOpen(true);
  };

  const handlePickReported = async () => {
    setReportPickOpen(false);
    setReportPickPreselect(null);
    if (roomId) {
      await refreshRoomState(roomId, filters);
      await refreshBoard();
      await refreshActivities();
    }
  };

  const handleBackToLobby = () => {
    setRoomId(null);
    setSessionId(null);
    setRoom(null);
    setDraftState(null);
    setBoardState(null);
    setActivities([]);
    setRosterAnalysis(null);
    setFillGapRecs([]);
    setReinforceRecs([]);
    setFilters(DEFAULT_FILTERS);
    setSkippedCount(0);
    setError(null);
    setActiveTab('board');
    setDetailPlayer(null);
    setDetailOpen(false);
    setReportPickPreselect(null);
    setPageView('lobby');
    sessionStorage.removeItem('draft-room-id');
  };

  // Auto-load restored room on mount
  useEffect(() => {
    if (isAuthenticated && restoredRoomId && !room) {
      handleSelectRoom(restoredRoomId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Periodically refresh room data in waiting state
  useEffect(() => {
    if (pageView !== 'waiting' || !roomId) return;
    const interval = setInterval(() => {
      refreshRoom().then(() => {
        // Auto-transition to draft if status changed to active
        if (room?.status === 'active') {
          setPageView('draft');
          refreshRoomState(roomId, DEFAULT_FILTERS);
          refreshBoard();
          refreshActivities();
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [pageView, roomId, room?.status, refreshRoom, refreshRoomState, refreshBoard, refreshActivities]);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <Loader2 className="h-8 w-8 text-accent animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </motion.div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-3rem)] bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-card border border-border p-8 rounded-xl shadow-soft text-center max-w-md"
        >
          <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
            <ClipboardList className="h-7 w-7 text-accent" />
          </div>
          <h1 className="text-2xl font-bold mb-3 text-foreground">Fantasy Draft Room</h1>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
            Sign in to access the Draft Room. Your sessions are saved so you can
            resume anytime.
          </p>
          <AuthButton />
        </motion.div>
      </div>
    );
  }

  // Room Lobby
  if (pageView === 'lobby') {
    return (
      <div className="min-h-screen bg-background">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border-b border-border"
        >
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-accent" />
              </div>
              <h1 className="text-lg font-bold text-foreground">Fantasy Draft Room</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPageView('legacy-picker')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Solo Sessions
              </button>
            </div>
          </div>
        </motion.header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <RoomLobby onSelectRoom={handleSelectRoom} />
          </motion.div>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 mt-6"
            >
              <Loader2 className="h-5 w-5 text-accent animate-spin" />
              <span className="text-muted-foreground text-sm">Loading room...</span>
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-stat-negative/10 border border-stat-negative/20 rounded-xl p-4 mt-4 flex items-start gap-3"
            >
              <AlertCircle className="h-5 w-5 text-stat-negative shrink-0 mt-0.5" />
              <p className="text-stat-negative text-sm">{error}</p>
            </motion.div>
          )}
        </main>
      </div>
    );
  }

  // Legacy Session Picker (backward compat)
  if (pageView === 'legacy-picker') {
    return (
      <div className="min-h-screen bg-background">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border-b border-border"
        >
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPageView('lobby')}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                Back to Rooms
              </button>
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-accent" />
              </div>
              <h1 className="text-lg font-bold text-foreground">Solo Draft Sessions</h1>
            </div>
          </div>
        </motion.header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <SessionPicker onSelectSession={handleSelectSession} />
          </motion.div>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 mt-6"
            >
              <Loader2 className="h-5 w-5 text-accent animate-spin" />
              <span className="text-muted-foreground text-sm">Loading session...</span>
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-stat-negative/10 border border-stat-negative/20 rounded-xl p-4 mt-4 flex items-start gap-3"
            >
              <AlertCircle className="h-5 w-5 text-stat-negative shrink-0 mt-0.5" />
              <p className="text-stat-negative text-sm">{error}</p>
            </motion.div>
          )}
        </main>
      </div>
    );
  }

  // Room Waiting Screen
  if (pageView === 'waiting' && room) {
    return (
      <div className="min-h-[calc(100vh-3rem)] bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <RoomWaitingScreen
            roomId={roomId!}
            room={room}
            isCommissioner={isCommissioner}
            onStartDraft={handleStartDraft}
            onBackToLobby={handleBackToLobby}
          />
        </div>
      </div>
    );
  }

  // Main draft room UI with tabs
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Room Header */}
      <RoomHeader
        roomName={room?.name ?? 'Fantasy Draft Room'}
        friendCode={room?.friend_code}
        members={room?.members.filter(m => !m.is_phantom).map(m => ({
          id: String(m.id),
          name: m.user_name ?? m.team_name,
          avatarUrl: m.user_avatar ?? undefined,
          isOnline: m.is_online,
        })) ?? []}
        isConnected={isRoomMode ? wsStatus === 'connected' : true}
        playersAvailable={draftState?.players_available}
        playersTaken={draftState?.players_taken_by_others}
        onBackToSessions={handleBackToLobby}
      />

      {/* Top controls bar */}
      <div className="bg-card/50 border-b border-border">
        <div className="max-w-7xl mx-auto px-4">
          {/* Row 1: Tabs + right controls */}
          <div className="flex items-center justify-between">
            {/* Tab bar */}
            <nav className="flex" role="tablist">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'text-accent'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="draft-tab-underline"
                        className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {isRoomMode && (
                <button
                  onClick={() => { setReportPickPreselect(null); setReportPickOpen(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Report Pick
                </button>
              )}
              <button
                onClick={() => setShowActivity(!showActivity)}
                className={cn(
                  'hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  showActivity
                    ? 'bg-accent/10 text-accent'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Activity
              </button>
            </div>
          </div>

          {/* Row 2: Global search bar */}
          {currentSessionId && (
            <div className="pb-3">
              <GlobalSearchBar
                onSearch={handleSearch}
                onPlayerClick={handleOpenPlayerDetail}
                onReportPick={isRoomMode ? handleReportPickFromSearch : handleOpenPlayerDetail}
              />
            </div>
          )}
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 pt-4">
              <div className="bg-stat-negative/10 border border-stat-negative/20 rounded-xl p-3 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-stat-negative shrink-0 mt-0.5" />
                <p className="text-stat-negative text-sm flex-1">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-stat-negative/60 hover:text-stat-negative text-sm"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      {(draftState || activeTab === 'board') && (
        <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
          <div className="flex gap-6">
            {/* Primary content area */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                {/* Draft Board tab */}
                {activeTab === 'board' && (
                  <motion.div
                    key="board"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isRoomMode ? (
                      <DraftBoard
                        boardState={boardState}
                        myMemberId={myMemberId}
                        isLoading={isLoading}
                        members={room?.members}
                        onPlayerClick={handleBoardPlayerClick}
                      />
                    ) : (
                      <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center min-h-[400px]">
                        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                          <LayoutGrid className="h-8 w-8 text-accent/60" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Draft Board</h3>
                        <p className="text-muted-foreground text-sm text-center max-w-sm">
                          The draft board is available in room mode. Create or join a room
                          to use the live draft board.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* My Team tab */}
                {activeTab === 'team' && draftState && (
                  <motion.div
                    key="team"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
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
                  </motion.div>
                )}

                {/* Recommendations tab */}
                {activeTab === 'recommendations' && draftState && (
                  <motion.div
                    key="recommendations"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Activity Feed sidebar */}
            <AnimatePresence>
              {showActivity && (
                <motion.aside
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 320 }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.25 }}
                  className="hidden lg:block shrink-0 overflow-hidden"
                >
                  <div className="w-[320px]">
                    {isRoomMode ? (
                      <ActivityFeed
                        activities={activities}
                        isLoading={isLoading}
                      />
                    ) : (
                      <TakenPlayersPanel takenPlayers={draftState?.taken_players ?? []} />
                    )}
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile activity/taken - shown below on small screens */}
          <div className="lg:hidden mt-6">
            {isRoomMode ? (
              <ActivityFeed activities={activities} isLoading={isLoading} />
            ) : (
              <TakenPlayersPanel takenPlayers={draftState?.taken_players ?? []} />
            )}
          </div>
        </main>
      )}

      {/* Player Detail Modal */}
      <DraftPlayerDetailModal
        player={detailPlayer}
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailPlayer(null); }}
        onReportPick={isRoomMode ? handleReportPickFromDetail : () => {}}
      />

      {/* Report Pick Modal */}
      {isRoomMode && roomId && (
        <ReportPickModal
          isOpen={reportPickOpen}
          onClose={() => { setReportPickOpen(false); setReportPickPreselect(null); }}
          sessionId={roomId}
          members={room?.members ?? []}
          onPickReported={handlePickReported}
          preselectedPlayer={reportPickPreselect}
          defaultMemberId={myMemberId}
        />
      )}
    </div>
  );
}
