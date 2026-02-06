import type {
  PlayerComparisonResponse,
  PlayerListResponse,
  PlayerStats,
  PlayerStatsFilters,
  PlayerStatsSearchResult,
} from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function getPlayers(filters: PlayerStatsFilters): Promise<PlayerListResponse> {
  const params = new URLSearchParams();
  params.set('page', filters.page.toString());
  params.set('per_page', filters.perPage.toString());
  params.set('sort_by', filters.sortBy);
  params.set('sort_order', filters.sortOrder);

  if (filters.search) params.set('search', filters.search);
  if (filters.position) params.set('position', filters.position);
  if (filters.team) params.set('team', filters.team);
  if (filters.season) params.set('season', filters.season);
  if (filters.view) params.set('view', filters.view);

  const response = await fetch(`${API_URL}/api/v1/players?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getPlayer(
  playerId: string,
  season?: string,
  view?: string,
): Promise<PlayerStats> {
  const params = new URLSearchParams();
  if (season) params.set('season', season);
  if (view) params.set('view', view);
  const qs = params.toString();

  const response = await fetch(
    `${API_URL}/api/v1/players/${playerId}${qs ? `?${qs}` : ''}`,
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function searchPlayers(
  query: string,
  limit: number = 10,
  signal?: AbortSignal,
  season?: string,
  view?: string,
): Promise<PlayerStatsSearchResult[]> {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('limit', limit.toString());
  if (season) params.set('season', season);
  if (view) params.set('view', view);

  const response = await fetch(
    `${API_URL}/api/v1/players/search?${params}`,
    { signal },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getTeams(season?: string, view?: string): Promise<string[]> {
  const params = new URLSearchParams();
  if (season) params.set('season', season);
  if (view) params.set('view', view);
  const qs = params.toString();

  const response = await fetch(`${API_URL}/api/v1/players/teams${qs ? `?${qs}` : ''}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function comparePlayers(
  playerIds: string[],
  season?: string,
  view?: string,
): Promise<PlayerComparisonResponse> {
  const params = new URLSearchParams();
  if (season) params.set('season', season);
  if (view) params.set('view', view);
  const qs = params.toString();

  const response = await fetch(`${API_URL}/api/v1/players/compare${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_ids: playerIds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}
