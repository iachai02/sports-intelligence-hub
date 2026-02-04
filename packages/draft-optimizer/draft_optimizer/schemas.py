"""Pydantic schemas for draft optimizer."""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

# 9-Category Fantasy Stats
CATEGORY_NAMES = ["PPG", "RPG", "APG", "SPG", "BPG", "TOV", "FG%", "FT%", "3PM"]


class CategoryStrength(str, Enum):
    """Strength classification for a stat category."""

    STRONG = "strong"
    AVERAGE = "average"
    WEAK = "weak"


class AffordabilityTag(str, Enum):
    """Affordability classification for recommendations."""

    AFFORDABLE = "affordable"  # <= 40% of remaining budget
    STRETCH = "stretch"  # > 40% of remaining budget


class CategoryAnalysis(BaseModel):
    """Analysis of a single stat category for the roster."""

    category: str = Field(description="Category name (PPG, RPG, etc.)")
    team_total: float = Field(description="Sum of category across roster")
    league_mean: float = Field(description="Average team total in league")
    league_std: float = Field(description="Standard deviation of team totals")
    z_score: float = Field(description="Team's z-score for this category")
    strength: CategoryStrength = Field(description="Classification based on z-score")


class RosterCategoryAnalysis(BaseModel):
    """Complete category analysis for a roster."""

    categories: list[CategoryAnalysis] = Field(description="Analysis per category")
    strong_categories: list[str] = Field(description="Categories where team is strong")
    weak_categories: list[str] = Field(description="Categories where team is weak")
    average_categories: list[str] = Field(description="Categories at league average")


class CategoryAwareRecommendation(BaseModel):
    """A recommendation with category-aware analysis."""

    player_id: str
    name: str
    team: str
    position: str
    projected_fpts: float
    auction_value: float
    suggested_max_bid: float
    fills_slot: str
    priority_rank: int
    # Category-aware fields
    strategy: Literal["fill_gap", "reinforce_strength"] = Field(
        description="Whether this player fills weak categories or reinforces strengths"
    )
    target_categories: list[str] = Field(
        description="Categories this player excels in that match the strategy"
    )
    affordability: AffordabilityTag = Field(description="Budget affordability tag")
    category_fit_score: float = Field(
        ge=0, le=100, description="How well player fits roster needs (0-100)"
    )
    # Individual stat projections
    points: float = Field(default=0.0, description="Points per game")
    rebounds: float = Field(default=0.0, description="Rebounds per game")
    assists: float = Field(default=0.0, description="Assists per game")
    steals: float = Field(default=0.0, description="Steals per game")
    blocks: float = Field(default=0.0, description="Blocks per game")
    turnovers: float = Field(default=0.0, description="Turnovers per game")
    fg_pct: float = Field(default=0.0, description="Field goal percentage")
    ft_pct: float = Field(default=0.0, description="Free throw percentage")
    three_made: float = Field(default=0.0, description="Three-pointers made per game")


class Position(str, Enum):
    """Player positions."""

    PG = "PG"
    SG = "SG"
    SF = "SF"
    PF = "PF"
    C = "C"


class RosterSlot(str, Enum):
    """Roster slot types for fantasy lineups.

    Standard lineup (10 starters + 3 bench = 13 total):
    - PG: Point Guard only
    - SG: Shooting Guard only
    - G: Guard (PG or SG eligible)
    - SF: Small Forward only
    - PF: Power Forward only
    - F: Forward (SF or PF eligible)
    - C: Center only
    - UTIL: Any position
    - BENCH: Any position (not in starting lineup)
    """

    PG = "PG"
    SG = "SG"
    G = "G"  # PG or SG
    SF = "SF"
    PF = "PF"
    F = "F"  # SF or PF
    C = "C"
    UTIL = "UTIL"  # Any position
    BENCH = "BENCH"  # Any position


# Which positions can fill each roster slot
SLOT_ELIGIBILITY: dict[RosterSlot, set[Position]] = {
    RosterSlot.PG: {Position.PG},
    RosterSlot.SG: {Position.SG},
    RosterSlot.G: {Position.PG, Position.SG},
    RosterSlot.SF: {Position.SF},
    RosterSlot.PF: {Position.PF},
    RosterSlot.F: {Position.SF, Position.PF},
    RosterSlot.C: {Position.C},
    RosterSlot.UTIL: {Position.PG, Position.SG, Position.SF, Position.PF, Position.C},
    RosterSlot.BENCH: {Position.PG, Position.SG, Position.SF, Position.PF, Position.C},
}


class PlayerProjection(BaseModel):
    """Player with projected fantasy performance and auction value."""

    id: str
    name: str
    team: str
    position: Position
    # Raw stat projections (season averages)
    points: float = Field(ge=0)
    rebounds: float = Field(ge=0)
    assists: float = Field(ge=0)
    steals: float = Field(ge=0)
    blocks: float = Field(ge=0)
    turnovers: float = Field(ge=0)
    fg_pct: float = Field(ge=0, le=1)
    ft_pct: float = Field(ge=0, le=1)
    three_made: float = Field(ge=0)  # 3-pointers made per game
    # Calculated values
    projected_fpts: float = Field(ge=0, description="Projected fantasy points per game")
    auction_value: float = Field(ge=1, description="Auction dollar value ($1 minimum)")


class RosterConfig(BaseModel):
    """Configuration for roster construction rules.

    Default is standard 13-roster fantasy basketball:
    - 10 starters: 1 PG, 1 SG, 1 G, 1 SF, 1 PF, 1 F, 1 C, 3 UTIL
    - 3 bench spots
    - $200 budget
    """

    slots: list[RosterSlot] = Field(
        default=[
            # Starters (10)
            RosterSlot.PG,
            RosterSlot.SG,
            RosterSlot.G,
            RosterSlot.SF,
            RosterSlot.PF,
            RosterSlot.F,
            RosterSlot.C,
            RosterSlot.UTIL,
            RosterSlot.UTIL,
            RosterSlot.UTIL,
            # Bench (3)
            RosterSlot.BENCH,
            RosterSlot.BENCH,
            RosterSlot.BENCH,
        ],
        description="Ordered list of roster slots to fill",
    )
    budget: float = Field(default=200.0, gt=0, description="Total auction budget in dollars")
    min_player_cost: float = Field(default=1.0, ge=0, description="Minimum cost per player")

    @property
    def roster_size(self) -> int:
        """Total number of roster spots."""
        return len(self.slots)

    @property
    def starter_count(self) -> int:
        """Number of starting (non-bench) spots."""
        return sum(1 for slot in self.slots if slot != RosterSlot.BENCH)


class OptimizationRequest(BaseModel):
    """Request to optimize a fantasy draft roster."""

    players: list[PlayerProjection] = Field(
        ..., min_length=13, description="Player pool to select from"
    )
    config: RosterConfig = Field(default_factory=RosterConfig)
    excluded_player_ids: list[str] = Field(
        default=[], description="Player IDs to exclude (already drafted)"
    )
    locked_player_ids: list[str] = Field(
        default=[], description="Player IDs that must be included"
    )


class SelectedPlayer(BaseModel):
    """A player selected for the optimal roster with their assigned slot."""

    player: PlayerProjection
    slot: RosterSlot
    is_starter: bool


class OptimizationResult(BaseModel):
    """Result of draft optimization."""

    status: str = Field(description="Solver status: 'Optimal', 'Infeasible', etc.")
    roster: list[SelectedPlayer] = Field(default=[], description="Selected players with slots")
    total_projected_fpts: float = Field(default=0.0, description="Total projected fantasy points")
    total_cost: float = Field(default=0.0, description="Total auction cost")
    budget_remaining: float = Field(default=0.0, description="Remaining budget")

    @property
    def starters(self) -> list[SelectedPlayer]:
        """Starting lineup only."""
        return [p for p in self.roster if p.is_starter]

    @property
    def bench(self) -> list[SelectedPlayer]:
        """Bench players only."""
        return [p for p in self.roster if not p.is_starter]
