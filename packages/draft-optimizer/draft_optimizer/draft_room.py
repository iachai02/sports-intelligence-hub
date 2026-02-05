"""Draft room state management for live auction drafts.

This module provides classes for tracking draft state during a live auction,
including roster management, budget tracking, and pick recommendations.
"""

import math
import statistics
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from draft_optimizer.features import calculate_auction_value_v2
from draft_optimizer.schemas import (
    CATEGORY_NAMES,
    SLOT_ELIGIBILITY,
    AffordabilityTag,
    CategoryAnalysis,
    CategoryAwareRecommendation,
    CategoryStrength,
    PlayerProjection,
    Position,
    RosterCategoryAnalysis,
    RosterConfig,
    RosterSlot,
)


@dataclass
class DraftedPlayer:
    """A player that has been drafted to a team."""

    player: PlayerProjection
    cost: float
    slot: RosterSlot
    drafted_at: datetime = field(default_factory=datetime.now)


@dataclass
class DraftAction:
    """A recorded draft action for undo support."""

    action_type: str  # "draft_for_me", "mark_taken", "undo"
    player_id: str
    data: dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class Recommendation:
    """A recommended pick with value analysis."""

    player: PlayerProjection
    suggested_max_bid: float
    value_vs_projection: float  # positive = good deal
    fills_slot: RosterSlot
    priority_rank: int


class DraftState:
    """Manages the state of a live draft session.

    Tracks:
    - My roster and remaining budget
    - Players taken by other teams
    - Available players
    - Action history for undo

    Provides:
    - Top N recommendations based on value and roster needs
    - Slot suggestions for new picks
    """

    def __init__(
        self,
        player_pool: list[PlayerProjection],
        config: RosterConfig | None = None,
        num_teams: int = 12,
    ) -> None:
        """Initialize a draft session.

        Args:
            player_pool: All available players with projections
            config: Roster configuration (defaults to standard 13-player)
            num_teams: Number of teams in the league
        """
        self.session_id = str(uuid.uuid4())
        self.created_at = datetime.now()
        self.config = config or RosterConfig()
        self.num_teams = num_teams

        # Player pool (immutable reference)
        self._player_pool = {p.id: p for p in player_pool}
        self._all_player_fpts = [p.projected_fpts for p in player_pool]

        # My roster state
        self.my_roster: list[DraftedPlayer] = []
        self.my_budget_remaining = self.config.budget

        # Taken players (by others)
        self.taken_player_ids: set[str] = set()

        # Action history for undo
        self._action_history: list[DraftAction] = []

        # Slots still needed (copy of config slots)
        self._slots_needed = list(self.config.slots)

    @property
    def available_players(self) -> list[PlayerProjection]:
        """Get players not yet drafted by anyone."""
        my_player_ids = {dp.player.id for dp in self.my_roster}
        unavailable = my_player_ids | self.taken_player_ids

        return [p for p in self._player_pool.values() if p.id not in unavailable]

    @property
    def roster_size(self) -> int:
        """Number of players on my roster."""
        return len(self.my_roster)

    @property
    def roster_spots_remaining(self) -> int:
        """Number of roster spots still to fill."""
        return len(self._slots_needed)

    @property
    def total_roster_value(self) -> float:
        """Sum of auction values of my drafted players."""
        return sum(dp.cost for dp in self.my_roster)

    def _find_best_slot_for_player(
        self, player: PlayerProjection
    ) -> RosterSlot | None:
        """Find the most specific available slot for a player's position."""
        player_pos = Position(player.position) if isinstance(player.position, str) else player.position

        # Priority order: most specific to least specific
        slot_priority = [
            RosterSlot.PG,
            RosterSlot.SG,
            RosterSlot.SF,
            RosterSlot.PF,
            RosterSlot.C,
            RosterSlot.G,
            RosterSlot.F,
            RosterSlot.UTIL,
            RosterSlot.BENCH,
        ]

        for slot in slot_priority:
            if slot in self._slots_needed and player_pos in SLOT_ELIGIBILITY[slot]:
                return slot

        return None

    def _recalculate_auction_value(self, player: PlayerProjection) -> float:
        """Recalculate auction value based on remaining pool."""
        available_fpts = [p.projected_fpts for p in self.available_players]

        return calculate_auction_value_v2(
            projected_fpts=player.projected_fpts,
            all_player_fpts=available_fpts,
            position=Position(player.position) if isinstance(player.position, str) else player.position,
            num_teams=self.num_teams,
            roster_size=self.config.roster_size,
            budget_per_team=self.config.budget,
        )

    def draft_player_for_me(
        self,
        player_id: str,
        cost: float,
        slot: RosterSlot | None = None,
    ) -> DraftedPlayer:
        """Add a player to my roster.

        Args:
            player_id: ID of player to draft
            cost: Auction cost paid
            slot: Roster slot to assign (auto-assigns if None)

        Returns:
            The drafted player record

        Raises:
            ValueError: If player not available, cost exceeds budget, or no slot available
        """
        if player_id not in self._player_pool:
            raise ValueError(f"Player {player_id} not in pool")

        if player_id in self.taken_player_ids:
            raise ValueError(f"Player {player_id} already taken")

        if any(dp.player.id == player_id for dp in self.my_roster):
            raise ValueError(f"Player {player_id} already on your roster")

        if cost > self.my_budget_remaining:
            raise ValueError(
                f"Cost ${cost} exceeds remaining budget ${self.my_budget_remaining}"
            )

        player = self._player_pool[player_id]

        # Find slot
        if slot is None:
            slot = self._find_best_slot_for_player(player)
        else:
            # Validate slot eligibility
            player_pos = Position(player.position) if isinstance(player.position, str) else player.position
            if slot not in self._slots_needed:
                raise ValueError(f"Slot {slot.value} already filled")
            if player_pos not in SLOT_ELIGIBILITY[slot]:
                raise ValueError(
                    f"Player position {player_pos.value} not eligible for slot {slot.value}"
                )

        if slot is None:
            raise ValueError(f"No available slot for player position {player.position}")

        # Record action for undo
        self._action_history.append(
            DraftAction(
                action_type="draft_for_me",
                player_id=player_id,
                data={"cost": cost, "slot": slot.value},
            )
        )

        # Create drafted player
        drafted = DraftedPlayer(player=player, cost=cost, slot=slot)
        self.my_roster.append(drafted)
        self.my_budget_remaining -= cost
        self._slots_needed.remove(slot)

        return drafted

    def mark_player_taken(self, player_id: str) -> None:
        """Mark a player as taken by another team.

        Args:
            player_id: ID of player taken

        Raises:
            ValueError: If player not in pool or already taken
        """
        if player_id not in self._player_pool:
            raise ValueError(f"Player {player_id} not in pool")

        if player_id in self.taken_player_ids:
            raise ValueError(f"Player {player_id} already marked as taken")

        if any(dp.player.id == player_id for dp in self.my_roster):
            raise ValueError(f"Player {player_id} is on your roster, not taken by others")

        # Record action for undo
        self._action_history.append(
            DraftAction(action_type="mark_taken", player_id=player_id)
        )

        self.taken_player_ids.add(player_id)

    def undo_last_action(self) -> DraftAction | None:
        """Undo the last draft action.

        Returns:
            The undone action, or None if no actions to undo
        """
        if not self._action_history:
            return None

        action = self._action_history.pop()

        if action.action_type == "draft_for_me":
            # Remove from roster
            player_id = action.player_id
            for i, dp in enumerate(self.my_roster):
                if dp.player.id == player_id:
                    self.my_budget_remaining += dp.cost
                    self._slots_needed.append(dp.slot)
                    del self.my_roster[i]
                    break

        elif action.action_type == "mark_taken":
            # Remove from taken set
            self.taken_player_ids.discard(action.player_id)

        return action

    def get_recommendations(
        self,
        top_n: int = 5,
        position_filter: Position | None = None,
    ) -> list[Recommendation]:
        """Get top N player recommendations.

        Considers:
        - Player value vs current auction market
        - Roster needs (unfilled slots)
        - Budget constraints

        Args:
            top_n: Number of recommendations to return
            position_filter: Only recommend players of this position

        Returns:
            List of recommendations sorted by priority
        """
        available = self.available_players

        if position_filter:
            available = [p for p in available if p.position == position_filter.value]

        # Calculate recommendations
        recommendations: list[Recommendation] = []

        for player in available:
            # Find slot this player would fill
            slot = self._find_best_slot_for_player(player)
            if slot is None:
                continue  # Can't fit on roster

            # Use original auction value (stable prices, not recalculated)
            current_value = player.auction_value

            # Suggested max bid (current value + small premium for elite players)
            premium = 1.1 if player.projected_fpts > 50 else 1.0
            suggested_bid = min(
                current_value * premium,
                self.my_budget_remaining - (self.roster_spots_remaining - 1),  # Leave $1 per remaining slot
            )
            suggested_bid = max(1.0, suggested_bid)

            # Value vs original projection (always 0 now since we use original value)
            value_diff = 0.0

            rec = Recommendation(
                player=player,
                suggested_max_bid=round(suggested_bid, 0),
                value_vs_projection=round(value_diff, 1),
                fills_slot=slot,
                priority_rank=0,
            )
            recommendations.append(rec)

        # Sort by projected fantasy points (best players first)
        recommendations.sort(key=lambda r: -r.player.projected_fpts)

        # Assign priority ranks
        for i, rec in enumerate(recommendations):
            rec.priority_rank = i + 1

        return recommendations[:top_n]

    def search_players(
        self,
        query: str,
        limit: int = 10,
        include_taken: bool = False,
    ) -> list[PlayerProjection]:
        """Search for players by name.

        Args:
            query: Search string (case-insensitive)
            limit: Maximum results
            include_taken: Whether to include players already drafted

        Returns:
            Matching players
        """
        query_lower = query.lower()
        pool = list(self._player_pool.values()) if include_taken else self.available_players
        matches = [p for p in pool if query_lower in p.name.lower()]
        matches.sort(key=lambda p: -p.projected_fpts)

        return matches[:limit]

    def _get_player_category_stats(self, player: PlayerProjection) -> dict[str, float]:
        """Extract category stats from a player."""
        return {
            "PPG": player.points,
            "RPG": player.rebounds,
            "APG": player.assists,
            "SPG": player.steals,
            "BPG": player.blocks,
            "TOV": player.turnovers,  # Lower is better
            "FG%": player.fg_pct,
            "FT%": player.ft_pct,
            "3PM": player.three_made,
        }

    def _calculate_league_averages(
        self, filled_slots: int | None = None
    ) -> dict[str, tuple[float, float]]:
        """Calculate league average and std dev for each category.

        Simulates what an "average" team would have based on the player pool.
        Assumes each team drafts roster_size players uniformly from the pool.

        When filled_slots is provided, scales the full-roster averages down
        proportionally so that comparisons are meaningful early in the draft.

        Args:
            filled_slots: Number of roster slots currently filled. If None,
                          uses full roster_size (no scaling).

        Returns:
            Dictionary mapping category -> (mean team total, std dev)
        """
        all_players = list(self._player_pool.values())
        if not all_players:
            return {cat: (0.0, 1.0) for cat in CATEGORY_NAMES}

        # Calculate category totals for each player
        player_stats: dict[str, list[float]] = {cat: [] for cat in CATEGORY_NAMES}
        for player in all_players:
            stats = self._get_player_category_stats(player)
            for cat in CATEGORY_NAMES:
                player_stats[cat].append(stats[cat])

        # Estimate team totals: roster_size players from top of pool
        # Each team picks ~roster_size players, distributed across the draft
        roster_size = self.config.roster_size
        num_teams = self.num_teams

        # Simulate multiple drafts to estimate team totals
        simulated_team_totals: dict[str, list[float]] = {cat: [] for cat in CATEGORY_NAMES}

        # Simple simulation: divide players into tiers, each team gets one from each tier
        for cat in CATEGORY_NAMES:
            # Sort players by this category (descending, except TOV ascending)
            sorted_vals = sorted(player_stats[cat], reverse=(cat != "TOV"))

            # Each team gets roster_size players spread across the ranking
            for team_offset in range(num_teams):
                team_total = 0.0
                for pick in range(roster_size):
                    player_idx = team_offset + pick * num_teams
                    if player_idx < len(sorted_vals):
                        team_total += sorted_vals[player_idx]
                simulated_team_totals[cat].append(team_total)

        # Calculate mean and std dev for each category (full roster)
        result: dict[str, tuple[float, float]] = {}
        for cat in CATEGORY_NAMES:
            totals = simulated_team_totals[cat]
            full_mean = statistics.mean(totals) if totals else 0.0
            full_std = statistics.stdev(totals) if len(totals) > 1 else 1.0
            # Ensure std is never zero to avoid division errors
            full_std = max(full_std, 0.001)

            # Scale by roster progress if filled_slots is provided
            if filled_slots is not None and filled_slots > 0 and filled_slots < roster_size:
                # Scale mean proportionally: mean * (filled / roster_size)
                scale_factor = filled_slots / roster_size
                scaled_mean = full_mean * scale_factor
                # Scale std by sqrt of scale factor (variance scales linearly, std by sqrt)
                scaled_std = full_std * math.sqrt(scale_factor)
                scaled_std = max(scaled_std, 0.001)
                result[cat] = (scaled_mean, scaled_std)
            else:
                result[cat] = (full_mean, full_std)

        return result

    def calculate_roster_category_strength(self) -> RosterCategoryAnalysis:
        """Analyze roster strengths/weaknesses across all 9 categories.

        Compares team's category totals to league averages using z-scores.
        League averages are scaled by roster progress (filled slots / total slots)
        so comparisons are meaningful early in the draft.

        Returns:
            RosterCategoryAnalysis with per-category analysis and summary
        """
        # Calculate league baselines, scaled by roster progress
        filled_slots = self.roster_size  # Number of players currently on roster

        # Edge case: empty roster - return all "average" strength
        if filled_slots == 0:
            empty_categories = [
                CategoryAnalysis(
                    category=cat,
                    team_total=0.0,
                    league_mean=0.0,
                    league_std=1.0,
                    z_score=0.0,
                    strength=CategoryStrength.AVERAGE,
                )
                for cat in CATEGORY_NAMES
            ]
            return RosterCategoryAnalysis(
                categories=empty_categories,
                strong_categories=[],
                weak_categories=[],
                average_categories=list(CATEGORY_NAMES),
            )

        league_averages = self._calculate_league_averages(filled_slots=filled_slots)

        # Calculate my team's category totals
        my_totals: dict[str, float] = {cat: 0.0 for cat in CATEGORY_NAMES}
        for drafted in self.my_roster:
            stats = self._get_player_category_stats(drafted.player)
            for cat in CATEGORY_NAMES:
                my_totals[cat] += stats[cat]

        # Build category analysis
        categories: list[CategoryAnalysis] = []
        strong_cats: list[str] = []
        weak_cats: list[str] = []
        average_cats: list[str] = []

        for cat in CATEGORY_NAMES:
            mean, std = league_averages[cat]
            team_total = my_totals[cat]

            # Calculate z-score (for TOV, lower is better so flip sign)
            z_score = (mean - team_total) / std if cat == "TOV" else (team_total - mean) / std

            # Classify strength
            if z_score > 1.0:
                strength = CategoryStrength.STRONG
                strong_cats.append(cat)
            elif z_score < -1.0:
                strength = CategoryStrength.WEAK
                weak_cats.append(cat)
            else:
                strength = CategoryStrength.AVERAGE
                average_cats.append(cat)

            categories.append(
                CategoryAnalysis(
                    category=cat,
                    team_total=round(team_total, 2),
                    league_mean=round(mean, 2),
                    league_std=round(std, 2),
                    z_score=round(z_score, 2),
                    strength=strength,
                )
            )

        return RosterCategoryAnalysis(
            categories=categories,
            strong_categories=strong_cats,
            weak_categories=weak_cats,
            average_categories=average_cats,
        )

    def _calculate_player_category_fit(
        self,
        player: PlayerProjection,
        roster_analysis: RosterCategoryAnalysis,
    ) -> tuple[float, float, list[str], list[str]]:
        """Score how well a player complements the roster's category needs.

        Returns BOTH a fill_gap score and a reinforce score so the player
        can appear in either list based on the sorting.

        Args:
            player: Player to evaluate
            roster_analysis: Current roster's category analysis

        Returns:
            Tuple of (fill_gap_score, reinforce_score, gap_categories, reinforce_categories)
        """
        player_stats = self._get_player_category_stats(player)

        # Calculate player's percentile in each category
        all_players = list(self._player_pool.values())
        player_percentiles: dict[str, float] = {}

        for cat in CATEGORY_NAMES:
            cat_values = [self._get_player_category_stats(p)[cat] for p in all_players]
            player_val = player_stats[cat]

            # For TOV, lower is better
            if cat == "TOV":
                rank = sum(1 for v in cat_values if v > player_val)
            else:
                rank = sum(1 for v in cat_values if v < player_val)

            percentile = rank / len(cat_values) if cat_values else 0.5
            player_percentiles[cat] = percentile

        # Find categories where player excels (top 30% - slightly more lenient)
        strong_in: list[str] = [
            cat for cat, pct in player_percentiles.items() if pct >= 0.70
        ]

        weak_cats = set(roster_analysis.weak_categories)
        strong_cats = set(roster_analysis.strong_categories)
        average_cats = set(roster_analysis.average_categories)

        # Categories this player can help with
        gap_fill_cats = [cat for cat in strong_in if cat in weak_cats]
        reinforce_cats = [cat for cat in strong_in if cat in strong_cats]
        average_help_cats = [cat for cat in strong_in if cat in average_cats]

        # Calculate fill_gap score
        # Prioritize: weak categories > average categories
        fill_gap_score = sum(player_percentiles[cat] * 100 for cat in gap_fill_cats)
        if not gap_fill_cats and average_help_cats:
            # No weak categories to fill, use average categories
            fill_gap_score = sum(player_percentiles[cat] * 75 for cat in average_help_cats[:3])
            gap_fill_cats = average_help_cats[:3]

        # Calculate reinforce score (equal weight, not half)
        reinforce_score = sum(player_percentiles[cat] * 100 for cat in reinforce_cats)

        # Normalize scores to 0-100
        max_possible = 300  # 3 categories at 100 each
        fill_gap_score = min(100, (fill_gap_score / max_possible) * 100)
        reinforce_score = min(100, (reinforce_score / max_possible) * 100)

        return round(fill_gap_score, 1), round(reinforce_score, 1), gap_fill_cats, reinforce_cats

    def _tag_affordability(self, suggested_bid: float) -> AffordabilityTag:
        """Classify affordability based on remaining budget.

        Two-tier system:
        - Affordable: <= 40% of remaining budget
        - Stretch: > 40% of remaining budget

        Args:
            suggested_bid: The suggested max bid for a player

        Returns:
            AffordabilityTag classification
        """
        if self.my_budget_remaining <= 0:
            return AffordabilityTag.STRETCH

        ratio = suggested_bid / self.my_budget_remaining

        if ratio <= 0.4:
            return AffordabilityTag.AFFORDABLE
        else:
            return AffordabilityTag.STRETCH

    def get_category_aware_recommendations(
        self,
        top_n: int = 10,
        position_filter: Position | None = None,
        scoring_mode: Literal["balanced", "value", "production"] = "balanced",
        min_cost: float | None = None,
        max_cost: float | None = None,
        min_fpts: float | None = None,
        max_fpts: float | None = None,
        affordability_filter: list[AffordabilityTag] | None = None,
        skipped_player_ids: set[str] | None = None,
    ) -> tuple[RosterCategoryAnalysis, list[CategoryAwareRecommendation], list[CategoryAwareRecommendation]]:
        """Get category-aware recommendations split by strategy.

        Returns recommendations in two groups:
        - Fill gap: Players that help with weak categories
        - Reinforce strength: Players that build on strong categories

        For early draft (0-2 players), ignores category fit and shows best overall
        value players since the team has no identity yet.

        Args:
            top_n: Total number of recommendations (split ~60/40)
            position_filter: Only recommend players of this position
            scoring_mode: How to weight scoring factors:
                - "balanced": 25% fit, 25% FPTS, 25% value, 25% production
                - "value": 20% fit, 20% FPTS, 40% value, 20% production
                - "production": 20% fit, 40% FPTS, 20% value, 20% production
            min_cost: Minimum auction value filter
            max_cost: Maximum auction value filter
            min_fpts: Minimum projected FPTS filter
            max_fpts: Maximum projected FPTS filter
            affordability_filter: Only show players with these affordability tags
            skipped_player_ids: Player IDs to exclude from recommendations

        Returns:
            Tuple of (roster_analysis, fill_gap_recs, reinforce_recs)
        """
        # Get roster analysis
        roster_analysis = self.calculate_roster_category_strength()

        available = self.available_players

        # Apply filters
        if position_filter:
            available = [p for p in available if p.position == position_filter.value]

        if skipped_player_ids:
            available = [p for p in available if p.id not in skipped_player_ids]

        if min_cost is not None:
            available = [p for p in available if p.auction_value >= min_cost]

        if max_cost is not None:
            available = [p for p in available if p.auction_value <= max_cost]

        if min_fpts is not None:
            available = [p for p in available if p.projected_fpts >= min_fpts]

        if max_fpts is not None:
            available = [p for p in available if p.projected_fpts <= max_fpts]

        # Calculate all recommendations with category fit
        all_recs: list[CategoryAwareRecommendation] = []

        for player in available:
            # Find slot this player would fill
            slot = self._find_best_slot_for_player(player)
            if slot is None:
                continue  # Can't fit on roster

            # Use original auction value (stable prices, not recalculated)
            current_value = player.auction_value

            # Suggested max bid
            premium = 1.1 if player.projected_fpts > 50 else 1.0
            suggested_bid = min(
                current_value * premium,
                self.my_budget_remaining - (self.roster_spots_remaining - 1),
            )
            suggested_bid = max(1.0, suggested_bid)

            # Calculate category fit scores for BOTH strategies
            gap_score, reinforce_score, gap_cats, reinforce_cats = self._calculate_player_category_fit(
                player, roster_analysis
            )

            # Get affordability tag
            affordability = self._tag_affordability(suggested_bid)

            # Common fields
            position_str = player.position.value if hasattr(player.position, 'value') else player.position
            suggested_max = round(suggested_bid, 0)

            # Create fill_gap recommendation
            fill_gap_rec = CategoryAwareRecommendation(
                player_id=player.id,
                name=player.name,
                team=player.team,
                position=position_str,
                projected_fpts=player.projected_fpts,
                auction_value=player.auction_value,
                suggested_max_bid=suggested_max,
                fills_slot=slot.value,
                priority_rank=0,
                strategy="fill_gap",
                target_categories=gap_cats if gap_cats else reinforce_cats[:3],
                affordability=affordability,
                category_fit_score=gap_score,
                points=player.points,
                rebounds=player.rebounds,
                assists=player.assists,
                steals=player.steals,
                blocks=player.blocks,
                turnovers=player.turnovers,
                fg_pct=player.fg_pct,
                ft_pct=player.ft_pct,
                three_made=player.three_made,
            )
            fill_gap_rec._gap_score = gap_score  # type: ignore[attr-defined]
            fill_gap_rec._reinforce_score = reinforce_score  # type: ignore[attr-defined]
            all_recs.append(fill_gap_rec)

            # Create reinforce recommendation (only if there are strong categories to reinforce)
            if reinforce_cats or roster_analysis.strong_categories:
                reinforce_rec = CategoryAwareRecommendation(
                    player_id=player.id,
                    name=player.name,
                    team=player.team,
                    position=position_str,
                    projected_fpts=player.projected_fpts,
                    auction_value=player.auction_value,
                    suggested_max_bid=suggested_max,
                    fills_slot=slot.value,
                    priority_rank=0,
                    strategy="reinforce_strength",
                    target_categories=reinforce_cats if reinforce_cats else gap_cats[:3],
                    affordability=affordability,
                    category_fit_score=reinforce_score,
                    points=player.points,
                    rebounds=player.rebounds,
                    assists=player.assists,
                    steals=player.steals,
                    blocks=player.blocks,
                    turnovers=player.turnovers,
                    fg_pct=player.fg_pct,
                    ft_pct=player.ft_pct,
                    three_made=player.three_made,
                )
                reinforce_rec._gap_score = gap_score  # type: ignore[attr-defined]
                reinforce_rec._reinforce_score = reinforce_score  # type: ignore[attr-defined]
                all_recs.append(reinforce_rec)

        # Apply affordability filter after creating recs (since we need suggested_bid)
        if affordability_filter:
            all_recs = [r for r in all_recs if r.affordability in affordability_filter]

        # Early draft mode: only with empty roster
        # Once you have ANY players, category analysis is meaningful
        is_early_draft = self.roster_size == 0

        if is_early_draft:
            # Only keep fill_gap recs (avoid duplicates since we created both types)
            fill_gap_only = [r for r in all_recs if r.strategy == "fill_gap"]
            # Sort by projected FPTS (best players first)
            fill_gap_only.sort(key=lambda r: -r.projected_fpts)

            # For early draft, put all in fill_gap (since no categories to reinforce)
            fill_gap_recs = fill_gap_only[:top_n]
            reinforce_recs: list[CategoryAwareRecommendation] = []

            for i, rec in enumerate(fill_gap_recs):
                rec.priority_rank = i + 1

            return roster_analysis, fill_gap_recs, reinforce_recs

        # Normal mode: use composite scoring based on mode
        # Calculate normalization factors for composite scoring
        if all_recs:
            all_fpts = [r.projected_fpts for r in all_recs]
            all_values = [r.auction_value for r in all_recs]

            min_fpts_norm = min(all_fpts)
            max_fpts_norm = max(all_fpts)
            fpts_range = max_fpts_norm - min_fpts_norm if max_fpts_norm > min_fpts_norm else 1.0

            min_value_norm = min(all_values)
            max_value_norm = max(all_values)
            value_range = max_value_norm - min_value_norm if max_value_norm > min_value_norm else 1.0

            # Scoring weights based on mode
            weights = {
                "balanced": {"fit": 0.25, "fpts": 0.25, "value": 0.25, "fpts_per_dollar": 0.25},
                "value": {"fit": 0.20, "fpts": 0.20, "value": 0.20, "fpts_per_dollar": 0.40},
                "production": {"fit": 0.20, "fpts": 0.40, "value": 0.20, "fpts_per_dollar": 0.20},
            }
            w = weights[scoring_mode]

            def composite_score(rec: CategoryAwareRecommendation) -> float:
                # Normalize FPTS to 0-100
                fpts_norm = ((rec.projected_fpts - min_fpts_norm) / fpts_range) * 100

                # Normalize auction value to 0-100 (higher value = more valuable player)
                value_norm = ((rec.auction_value - min_value_norm) / value_range) * 100

                # FPTS per dollar (value efficiency) - normalized
                # Higher is better (getting more production for your money)
                fpts_per_dollar = rec.projected_fpts / max(rec.auction_value, 1.0)
                # Normalize roughly: elite ~0.8-1.0 FPTS/$, average ~0.5-0.7, bench ~1.5+
                # Invert: we want high FPTS AND reasonable cost, not just cheap players
                # Use sqrt to dampen extreme values from $1 players
                fpts_per_dollar_norm = min(100, fpts_per_dollar * 50)

                return (
                    rec.category_fit_score * w["fit"]
                    + fpts_norm * w["fpts"]
                    + value_norm * w["value"]
                    + fpts_per_dollar_norm * w["fpts_per_dollar"]
                )

            # Score all recommendations
            for rec in all_recs:
                rec._composite_score = composite_score(rec)  # type: ignore[attr-defined]

        # Split by strategy
        fill_gap_recs = [r for r in all_recs if r.strategy == "fill_gap"]
        reinforce_recs = [r for r in all_recs if r.strategy == "reinforce_strength"]

        # Sort both groups by composite score
        fill_gap_recs.sort(
            key=lambda r: (-getattr(r, "_composite_score", 0), -r.projected_fpts)
        )
        reinforce_recs.sort(
            key=lambda r: (-getattr(r, "_composite_score", 0), -r.projected_fpts)
        )

        # Allocate ~60% to fill_gap, ~40% to reinforce
        fill_gap_count = max(1, int(top_n * 0.6))
        reinforce_count = max(1, top_n - fill_gap_count)

        fill_gap_recs = fill_gap_recs[:fill_gap_count]
        reinforce_recs = reinforce_recs[:reinforce_count]

        # Assign priority ranks within each group
        for i, rec in enumerate(fill_gap_recs):
            rec.priority_rank = i + 1
        for i, rec in enumerate(reinforce_recs):
            rec.priority_rank = i + 1

        return roster_analysis, fill_gap_recs, reinforce_recs

    def get_taken_players(self) -> list[PlayerProjection]:
        """Get all players marked as taken by other teams.

        Returns:
            List of PlayerProjection objects for taken players, sorted by FPTS descending
        """
        taken = [
            self._player_pool[pid]
            for pid in self.taken_player_ids
            if pid in self._player_pool
        ]
        taken.sort(key=lambda p: -p.projected_fpts)
        return taken

    def get_state_summary(self) -> dict[str, Any]:
        """Get a summary of current draft state."""
        return {
            "session_id": self.session_id,
            "my_roster_size": self.roster_size,
            "roster_spots_remaining": self.roster_spots_remaining,
            "budget_remaining": self.my_budget_remaining,
            "total_spent": self.config.budget - self.my_budget_remaining,
            "players_taken_by_others": len(self.taken_player_ids),
            "players_available": len(self.available_players),
            "slots_needed": [s.value for s in self._slots_needed],
        }
