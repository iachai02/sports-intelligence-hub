import type {
  CategoryRecommendationsResponse,
  CreateSessionResponse,
  DraftState,
  OptimizeRequest,
  OptimizeResponse,
  PlayerSearchResult,
  Recommendation,
} from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function optimizeRoster(request: OptimizeRequest = {}): Promise<OptimizeResponse> {
  const response = await fetch(`${API_URL}/api/v1/draft/optimize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      use_mock_data: true,
      ...request,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Draft Room API Functions

export async function createDraftSession(
  numTeams: number = 12,
  budget: number = 200,
  useRealData: boolean = true,
  season: string = '2024-25',
): Promise<CreateSessionResponse> {
  const response = await fetch(`${API_URL}/api/v1/draft-room/session/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      use_mock_data: !useRealData,
      use_real_data: useRealData,
      num_teams: numTeams,
      budget: budget,
      season: season,
      min_games: 20,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getDraftState(sessionId: string): Promise<DraftState> {
  const response = await fetch(`${API_URL}/api/v1/draft-room/session/${sessionId}/state`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function draftPlayer(
  sessionId: string,
  playerId: string,
  cost: number,
  slot?: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/draft-room/session/${sessionId}/draft-for-me`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId, cost, slot }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
}

export async function markPlayerTaken(sessionId: string, playerId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/draft-room/session/${sessionId}/mark-taken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
}

export async function getRecommendations(
  sessionId: string,
  topN: number = 5,
): Promise<Recommendation[]> {
  const response = await fetch(
    `${API_URL}/api/v1/draft-room/session/${sessionId}/recommendations?top_n=${topN}`,
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function searchPlayers(
  sessionId: string,
  query: string,
  includeTaken: boolean = false,
  signal?: AbortSignal,
): Promise<PlayerSearchResult[]> {
  const response = await fetch(
    `${API_URL}/api/v1/draft-room/session/${sessionId}/search?q=${encodeURIComponent(query)}&include_taken=${includeTaken}`,
    { signal },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function undoLastAction(sessionId: string): Promise<{ status: string }> {
  const response = await fetch(`${API_URL}/api/v1/draft-room/session/${sessionId}/undo`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export interface RecommendationFilters {
  position?: string;
  scoringMode?: 'balanced' | 'value' | 'production';
  minCost?: number;
  maxCost?: number;
  minFpts?: number;
  maxFpts?: number;
  affordability?: string[];
  skippedIds?: string[];
}

export async function getCategoryRecommendations(
  sessionId: string,
  topN: number = 10,
  filters?: RecommendationFilters,
): Promise<CategoryRecommendationsResponse> {
  const params = new URLSearchParams();
  params.set('top_n', topN.toString());

  if (filters) {
    if (filters.position) params.set('position', filters.position);
    if (filters.scoringMode) params.set('scoring_mode', filters.scoringMode);
    if (filters.minCost !== undefined) params.set('min_cost', filters.minCost.toString());
    if (filters.maxCost !== undefined) params.set('max_cost', filters.maxCost.toString());
    if (filters.minFpts !== undefined) params.set('min_fpts', filters.minFpts.toString());
    if (filters.maxFpts !== undefined) params.set('max_fpts', filters.maxFpts.toString());
    if (filters.affordability?.length) params.set('affordability', filters.affordability.join(','));
    if (filters.skippedIds?.length) params.set('skipped_ids', filters.skippedIds.join(','));
  }

  const response = await fetch(
    `${API_URL}/api/v1/draft-room/session/${sessionId}/category-recommendations?${params}`,
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}
