"""Feature engineering for fantasy basketball projections.

This module calculates fantasy points using 9-category scoring and
generates auction values based on projected performance.
"""

import math

from draft_optimizer.schemas import PlayerProjection, Position

# 9-Category Fantasy Scoring Weights
# Standard Yahoo/ESPN scoring system
SCORING_WEIGHTS = {
    "points": 1.0,
    "rebounds": 1.2,
    "assists": 1.5,
    "steals": 3.0,
    "blocks": 3.0,
    "turnovers": -1.0,
    # Percentage categories get bonuses based on volume
    # FG%: bonus scales with FG attempts (approximated by points)
    # FT%: bonus scales with FT attempts (approximated)
    # 3PT: flat bonus per made three
    "three_made": 0.5,
}

# Bonus multipliers for shooting percentages
# These reward efficient high-volume shooters
FG_PCT_BASELINE = 0.45  # League average
FT_PCT_BASELINE = 0.75  # League average


def calculate_fantasy_points(
    points: float,
    rebounds: float,
    assists: float,
    steals: float,
    blocks: float,
    turnovers: float,
    fg_pct: float,
    ft_pct: float,
    three_made: float,
    *,
    include_pct_bonus: bool = True,
) -> float:
    """Calculate fantasy points using 9-category scoring.

    Args:
        points: Points per game
        rebounds: Rebounds per game
        assists: Assists per game
        steals: Steals per game
        blocks: Blocks per game
        turnovers: Turnovers per game
        fg_pct: Field goal percentage (0-1)
        ft_pct: Free throw percentage (0-1)
        three_made: Three-pointers made per game
        include_pct_bonus: Whether to include FG%/FT% bonuses

    Returns:
        Calculated fantasy points per game
    """
    # Base scoring
    fpts = (
        points * SCORING_WEIGHTS["points"]
        + rebounds * SCORING_WEIGHTS["rebounds"]
        + assists * SCORING_WEIGHTS["assists"]
        + steals * SCORING_WEIGHTS["steals"]
        + blocks * SCORING_WEIGHTS["blocks"]
        + turnovers * SCORING_WEIGHTS["turnovers"]
        + three_made * SCORING_WEIGHTS["three_made"]
    )

    # Shooting percentage bonuses (reward efficiency)
    if include_pct_bonus:
        # FG% bonus: scales with scoring volume
        # A 50% shooter scoring 20 PPG gets more bonus than one scoring 10 PPG
        fg_bonus = (fg_pct - FG_PCT_BASELINE) * (points / 10) * 2.0
        fpts += max(fg_bonus, -2.0)  # Cap the penalty

        # FT% bonus: scales with assumed FT attempts (roughly points/4)
        ft_attempts_approx = points / 4
        ft_bonus = (ft_pct - FT_PCT_BASELINE) * ft_attempts_approx * 0.5
        fpts += max(ft_bonus, -1.0)  # Cap the penalty

    return round(fpts, 2)


def calculate_auction_value(
    projected_fpts: float,
    total_budget: float = 200.0,
    roster_size: int = 13,
    player_pool_size: int = 150,
    *,
    replacement_level_percentile: float = 0.6,
) -> float:
    """Calculate auction value based on projected fantasy points.

    Uses a value-over-replacement approach:
    1. Estimate replacement-level production (60th percentile of draftable players)
    2. Calculate value above replacement
    3. Scale to auction budget

    Args:
        projected_fpts: Player's projected fantasy points per game
        total_budget: Total auction budget
        roster_size: Number of roster spots
        player_pool_size: Approximate number of draftable players
        replacement_level_percentile: Where replacement level falls

    Returns:
        Auction value in dollars (minimum $1)
    """
    # Replacement level is roughly the 60th percentile player in a standard draft
    # We estimate this as ~70% of a good starter's production
    replacement_level_fpts = 25.0  # Approximate replacement level

    # Value over replacement
    vor = max(projected_fpts - replacement_level_fpts, 0)

    # Scale to budget
    # Top players might be 20+ FPTS above replacement
    # We allocate roughly 80% of budget to value above replacement
    # (20% goes to $1 minimum bids for replacement-level players)
    available_budget = total_budget * 0.80
    max_vor = 25.0  # Elite players ~50 FPTS, replacement ~25, so max VOR ~25

    # Linear scaling with diminishing returns at the top
    if vor > 0:
        # Square root scaling gives diminishing returns for elite players
        scaled_vor = math.sqrt(vor / max_vor) * max_vor
        value = (scaled_vor / max_vor) * (available_budget / roster_size) * 3
    else:
        value = 0

    # Minimum $1, maximum ~$70 for elite players
    return max(1.0, min(round(value, 0), 70.0))


def calculate_player_projection(
    player_id: str,
    name: str,
    team: str,
    position: str | Position,
    stats: dict[str, float],
    budget: float = 200.0,
    roster_size: int = 13,
) -> PlayerProjection:
    """Create a PlayerProjection from raw stats.

    Args:
        player_id: Unique player identifier
        name: Player name
        team: Team abbreviation
        position: Player position (PG, SG, SF, PF, C)
        stats: Dictionary with keys: points, rebounds, assists, steals,
               blocks, turnovers, fg_pct, ft_pct, three_made
        budget: Auction budget for value calculation
        roster_size: Roster size for value calculation

    Returns:
        PlayerProjection with calculated fantasy points and auction value
    """
    projected_fpts = calculate_fantasy_points(
        points=stats.get("points", 0),
        rebounds=stats.get("rebounds", 0),
        assists=stats.get("assists", 0),
        steals=stats.get("steals", 0),
        blocks=stats.get("blocks", 0),
        turnovers=stats.get("turnovers", 0),
        fg_pct=stats.get("fg_pct", 0.45),
        ft_pct=stats.get("ft_pct", 0.75),
        three_made=stats.get("three_made", 0),
    )

    auction_value = calculate_auction_value(
        projected_fpts=projected_fpts,
        total_budget=budget,
        roster_size=roster_size,
    )

    # Convert string to Position enum if needed
    pos = Position(position) if isinstance(position, str) else position

    return PlayerProjection(
        id=player_id,
        name=name,
        team=team,
        position=pos,
        points=stats.get("points", 0),
        rebounds=stats.get("rebounds", 0),
        assists=stats.get("assists", 0),
        steals=stats.get("steals", 0),
        blocks=stats.get("blocks", 0),
        turnovers=stats.get("turnovers", 0),
        fg_pct=stats.get("fg_pct", 0.45),
        ft_pct=stats.get("ft_pct", 0.75),
        three_made=stats.get("three_made", 0),
        projected_fpts=projected_fpts,
        auction_value=auction_value,
    )
