import type {
  CategoryRecommendationsResponse,
  CreateSessionResponse,
  DraftSessionListItem,
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
    credentials: 'include',
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

// Draft Session API Functions

export async function listDraftSessions(): Promise<DraftSessionListItem[]> {
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function createDraftSession(
  numTeams: number = 12,
  budget: number = 200,
  name: string = 'Draft Session',
  season: string = '2024-25',
): Promise<CreateSessionResponse> {
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      name,
      num_teams: numTeams,
      budget: budget,
      season: season,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getDraftState(sessionId: number): Promise<DraftState> {
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/${sessionId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function draftPlayer(
  sessionId: number,
  playerId: string,
  cost: number,
  slot?: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/${sessionId}/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ player_id: playerId, cost, slot }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
}

export async function markPlayerTaken(sessionId: number, playerId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/${sessionId}/taken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ player_id: playerId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
}

export async function skipPlayer(sessionId: number, playerId: string, reason?: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/${sessionId}/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ player_id: playerId, reason }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
}

export async function getRecommendations(
  sessionId: number,
  topN: number = 5,
): Promise<Recommendation[]> {
  const response = await fetch(
    `${API_URL}/api/v1/draft-sessions/${sessionId}/recommendations?top_n=${topN}`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function searchPlayers(
  sessionId: number,
  query: string,
  includeTaken: boolean = false,
  signal?: AbortSignal,
): Promise<PlayerSearchResult[]> {
  const response = await fetch(
    `${API_URL}/api/v1/draft-sessions/${sessionId}/search?q=${encodeURIComponent(query)}&include_taken=${includeTaken}`,
    { signal, credentials: 'include' },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function undoLastAction(sessionId: number): Promise<{ status: string }> {
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/${sessionId}/undo`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function deleteDraftSession(sessionId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/${sessionId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
}

export async function updateDraftSession(
  sessionId: number,
  data: { name?: string; status?: string },
): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
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
  sessionId: number,
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
    `${API_URL}/api/v1/draft-sessions/${sessionId}/recommendations?${params}`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}
