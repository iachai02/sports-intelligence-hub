export interface SelectedPlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  slot: string;
  is_starter: boolean;
  projected_fpts: number;
  auction_value: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  fg_pct: number;
  ft_pct: number;
  tpm: number;
}

export interface OptimizeResponse {
  status: string;
  total_projected_fpts: number;
  total_cost: number;
  budget: number;
  budget_remaining: number;
  roster_size: number;
  starter_count: number;
  roster: SelectedPlayer[];
}

export interface OptimizeRequest {
  use_mock_data?: boolean;
  budget?: number;
  excluded_player_ids?: string[];
}

// Draft Room Types

export interface RosterPlayer {
  player_id: string;
  name: string;
  team: string;
  position: string;
  slot: string;
  cost: number;
  projected_fpts: number;
}

export interface TakenPlayer {
  player_id: string;
  name: string;
  team: string;
  position: string;
  projected_fpts: number;
  auction_value: number;
}

export interface DraftState {
  session_id: number;
  my_roster: RosterPlayer[];
  budget_remaining: number;
  budget_total: number;
  roster_size: number;
  roster_spots_remaining: number;
  players_taken_by_others: number;
  players_available: number;
  slots_needed: string[];
  taken_players: TakenPlayer[];
}

export interface Recommendation {
  player_id: string;
  name: string;
  team: string;
  position: string;
  projected_fpts: number;
  auction_value: number;
  suggested_max_bid: number;
  value_vs_projection: number;
  fills_slot: string;
  priority_rank: number;
}

export interface PlayerSearchResult {
  player_id: string;
  name: string;
  team: string;
  position: string;
  projected_fpts: number;
  auction_value: number;
  is_available: boolean;
}

export interface CreateSessionResponse {
  session_id: number;
  name: string;
  roster_size: number;
  budget: number;
  num_teams: number;
  player_count: number;
}

export interface DraftSessionListItem {
  id: number;
  name: string;
  status: string;
  budget_total: number;
  num_teams: number;
  season: string;
  pick_count: number;
  created_at: string;
  updated_at: string;
}

// Category-Aware Recommendations Types

export type CategoryStrength = 'strong' | 'average' | 'weak';
export type AffordabilityTag = 'affordable' | 'stretch';
export type RecommendationStrategy = 'fill_gap' | 'reinforce_strength';

export interface CategoryAnalysis {
  category: string;
  team_total: number;
  league_mean: number;
  league_std: number;
  z_score: number;
  strength: CategoryStrength;
}

export interface RosterCategoryAnalysis {
  categories: CategoryAnalysis[];
  strong_categories: string[];
  weak_categories: string[];
  average_categories: string[];
}

export interface CategoryAwareRecommendation {
  player_id: string;
  name: string;
  team: string;
  position: string;
  projected_fpts: number;
  auction_value: number;
  suggested_max_bid: number;
  fills_slot: string;
  priority_rank: number;
  strategy: RecommendationStrategy;
  target_categories: string[];
  affordability: AffordabilityTag;
  category_fit_score: number;
  // Individual stat projections
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fg_pct: number;
  ft_pct: number;
  three_made: number;
}

export interface CategoryRecommendationsResponse {
  roster_analysis: RosterCategoryAnalysis;
  fill_gap_recommendations: CategoryAwareRecommendation[];
  reinforce_recommendations: CategoryAwareRecommendation[];
}

// Room / Multi-User Types

export interface RoomMember {
  id: number;
  user_id: number | null;
  team_name: string;
  team_order: number;
  is_phantom: boolean;
  is_online: boolean;
  user_name: string | null;
  user_avatar: string | null;
}

export interface RoomListItem {
  id: number;
  name: string;
  friend_code: string;
  status: string;
  budget_total: number;
  num_teams: number;
  season: string;
  member_count: number;
  created_at: string;
}

export interface RoomDetails {
  id: number;
  name: string;
  friend_code: string;
  draft_format: string;
  status: string;
  budget_total: number;
  roster_size: number;
  num_teams: number;
  season: string;
  commissioner_id: number;
  members: RoomMember[];
  created_at: string;
}

export interface CreateRoomResponse {
  room_id: number;
  friend_code: string;
  name: string;
  budget: number;
  num_teams: number;
}

export interface ActivityLogEntry {
  id: number;
  action_type: string;
  payload: Record<string, unknown> | null;
  user_name: string | null;
  created_at: string;
}

export interface BoardTeam {
  member_id: number;
  team_name: string;
  team_order: number;
  is_phantom: boolean;
  user_id: number | null;
  budget_total: number;
  budget_remaining: number;
  total_spent: number;
  pick_count: number;
  picks: BoardPick[];
}

export interface BoardPick {
  player_id: string;
  player_name: string;
  purchase_price: number;
  slot: string | null;
  pick_order: number | null;
  picked_at: string;
}

export interface BoardState {
  session_id: number;
  num_teams: number;
  roster_size: number;
  teams: BoardTeam[];
  total_picks: number;
}

export type RoomStatus = 'waiting' | 'active' | 'completed' | 'archived';

// WebSocket message types
export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

export interface WsPickReported extends WsMessage {
  type: 'pick_reported';
  player_id: string;
  player_name: string;
  team_name: string;
  member_id: number;
  price: number;
  slot: string | null;
  reported_by: string;
  pick_order: number;
}

export interface WsPickUndone extends WsMessage {
  type: 'pick_undone';
  player_id: string;
  player_name: string;
  team_name: string;
  undone_by: string;
}

export interface WsMemberEvent extends WsMessage {
  type: 'member_joined' | 'member_left' | 'member_connected' | 'member_disconnected';
  user_id: number;
  user_name: string;
  connected_users?: number[];
}

// Player Stats Browser Types

export interface PlayerStats {
  player_id: string;
  name: string;
  team: string;
  position: string;
  projected_fpts: number;
  auction_value: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  fg_pct: number;
  ft_pct: number;
  three_pm: number;
}

export interface PlayerListResponse {
  players: PlayerStats[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  season: string;
  view: string;
}

export interface PlayerStatsSearchResult {
  player_id: string;
  name: string;
  team: string;
  position: string;
  projected_fpts: number;
  auction_value: number;
}

export interface PlayerComparisonResponse {
  players: PlayerStats[];
}

export interface PlayerStatsFilters {
  search?: string;
  position?: string;
  team?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  page: number;
  perPage: number;
  season?: string;
  view?: 'actual' | 'projected';
}

export type StatsViewMode = {
  season: string;
  view: 'actual' | 'projected';
  label: string;
};

export const STATS_VIEW_OPTIONS: StatsViewMode[] = [
  { season: '2022-23', view: 'actual', label: '2022-23' },
  { season: '2023-24', view: 'actual', label: '2023-24' },
  { season: '2024-25', view: 'actual', label: '2024-25' },
  { season: '2025-26', view: 'projected', label: '2025-26 Projected' },
];

// Authentication Types

export interface User {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  preferences: UserPreferences;
  created_at: string;
}

export interface UserPreferences {
  theme?: 'light' | 'dark';
  defaultScoringMode?: 'balanced' | 'value' | 'production';
  defaultPosition?: string;
  notifications?: boolean;
}
