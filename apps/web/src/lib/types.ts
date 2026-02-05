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
  session_id: string;
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
  session_id: string;
  roster_size: number;
  budget: number;
  num_teams: number;
  player_count: number;
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
}
