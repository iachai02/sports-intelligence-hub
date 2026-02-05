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

  const response = await fetch(`${API_URL}/api/v1/players?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getPlayer(playerId: string): Promise<PlayerStats> {
  const response = await fetch(`${API_URL}/api/v1/players/${playerId}`);

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
): Promise<PlayerStatsSearchResult[]> {
  const response = await fetch(
    `${API_URL}/api/v1/players/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    { signal },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getTeams(): Promise<string[]> {
  const response = await fetch(`${API_URL}/api/v1/players/teams`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function comparePlayers(playerIds: string[]): Promise<PlayerComparisonResponse> {
  const response = await fetch(`${API_URL}/api/v1/players/compare`, {
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
