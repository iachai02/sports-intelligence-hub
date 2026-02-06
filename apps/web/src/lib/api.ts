import type {
  ActivityLogEntry,
  BoardState,
  CategoryRecommendationsResponse,
  CreateRoomResponse,
  CreateSessionResponse,
  DraftSessionListItem,
  DraftState,
  OptimizeRequest,
  OptimizeResponse,
  PlayerSearchResult,
  Recommendation,
  RoomDetails,
  RoomListItem,
  RoomMember,
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

export async function getDraftState(sessionId: number, view?: string): Promise<DraftState> {
  const params = view ? `?view=${view}` : '';
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/${sessionId}${params}`, {
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
  view?: string,
): Promise<PlayerSearchResult[]> {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('include_taken', String(includeTaken));
  if (view) params.set('view', view);

  const response = await fetch(
    `${API_URL}/api/v1/draft-sessions/${sessionId}/search?${params}`,
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
  view?: string,
): Promise<CategoryRecommendationsResponse> {
  const params = new URLSearchParams();
  params.set('top_n', topN.toString());
  if (view) params.set('view', view);

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

// --- Room API Functions ---

export async function createRoom(
  name: string = 'Draft Room',
  budget: number = 200,
  numTeams: number = 12,
  season: string = '2024-25',
  teamName: string = 'My Team',
): Promise<CreateRoomResponse> {
  const response = await fetch(`${API_URL}/api/v1/rooms/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      name,
      budget,
      num_teams: numTeams,
      season,
      team_name: teamName,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function listRooms(): Promise<RoomListItem[]> {
  const response = await fetch(`${API_URL}/api/v1/rooms/`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getRoomDetails(roomId: number): Promise<RoomDetails> {
  const response = await fetch(`${API_URL}/api/v1/rooms/${roomId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function joinRoom(friendCode: string, teamName: string): Promise<RoomMember> {
  const response = await fetch(`${API_URL}/api/v1/rooms/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ friend_code: friendCode, team_name: teamName }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function leaveRoom(roomId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/rooms/${roomId}/leave`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
}

export async function getRoomMembers(roomId: number): Promise<RoomMember[]> {
  const response = await fetch(`${API_URL}/api/v1/rooms/${roomId}/members`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getRoomActivity(
  roomId: number,
  limit: number = 50,
  offset: number = 0,
): Promise<ActivityLogEntry[]> {
  const response = await fetch(
    `${API_URL}/api/v1/rooms/${roomId}/activity?limit=${limit}&offset=${offset}`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function reportPick(
  sessionId: number,
  playerId: string,
  memberId: number,
  price: number,
  slot?: string,
): Promise<{ status: string; player_id: string; player_name: string; member_id: number; pick_order: number }> {
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/${sessionId}/report-pick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ player_id: playerId, member_id: memberId, price, slot }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function undoRoomPick(sessionId: number): Promise<{ status: string }> {
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/${sessionId}/undo-pick`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getRoomState(sessionId: number, view?: string): Promise<DraftState> {
  const params = view ? `?view=${view}` : '';
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/${sessionId}/state${params}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getBoardState(sessionId: number): Promise<BoardState> {
  const response = await fetch(`${API_URL}/api/v1/draft-sessions/${sessionId}/board`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getRoomRecommendations(
  sessionId: number,
  topN: number = 10,
  filters?: RecommendationFilters,
  view?: string,
): Promise<CategoryRecommendationsResponse> {
  const params = new URLSearchParams();
  params.set('top_n', topN.toString());
  if (view) params.set('view', view);

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
    `${API_URL}/api/v1/draft-sessions/${sessionId}/room-recommendations?${params}`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function searchRoomPlayers(
  sessionId: number,
  query: string,
  includeTaken: boolean = false,
  signal?: AbortSignal,
  view?: string,
): Promise<PlayerSearchResult[]> {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('include_taken', String(includeTaken));
  if (view) params.set('view', view);

  const response = await fetch(
    `${API_URL}/api/v1/draft-sessions/${sessionId}/room-search?${params}`,
    { signal, credentials: 'include' },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getPlayerDetail(playerId: string): Promise<import('./types').PlayerStats> {
  const response = await fetch(`${API_URL}/api/v1/players/${encodeURIComponent(playerId)}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getWsToken(): Promise<string> {
  const response = await fetch(`${API_URL}/api/v1/auth/ws-token`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}
