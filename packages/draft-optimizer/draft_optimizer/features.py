"""Feature engineering for fantasy basketball projections.

This module calculates fantasy points using 9-category scoring and
generates auction values based on projected performance.
"""

import math
from collections.abc import Sequence
from typing import Any

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
    fga: float | None = None,
    fta: float | None = None,
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
        fga: Field goal attempts per game (for volume-weighted FG% bonus)
        fta: Free throw attempts per game (for volume-weighted FT% bonus)
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

    # Shooting percentage bonuses (reward efficiency WITH volume)
    # Key insight: 88% FT on 8 FTA > 90% FT on 3 FTA
    if include_pct_bonus:
        # FG% bonus: volume-weighted
        # Uses actual FGA if provided, otherwise estimates from points
        fg_attempts = fga if fga is not None else points / 1.1  # ~1.1 pts per FGA
        # Bonus = (efficiency above baseline) × volume factor
        # High volume (15+ FGA) gets full weight, low volume (<8 FGA) gets reduced weight
        fg_volume_factor = min(fg_attempts / 12.0, 1.5)  # Scale: 12 FGA = 1.0x
        fg_bonus = (fg_pct - FG_PCT_BASELINE) * fg_volume_factor * 3.0
        fpts += max(fg_bonus, -2.0)  # Cap the penalty

        # FT% bonus: volume-weighted (this is the key fix!)
        # 90% on 3 FTA = 0.15 × 0.5 × 3 = 0.225 bonus
        # 88% on 8 FTA = 0.13 × 1.0 × 3 = 0.39 bonus (higher!)
        ft_attempts = fta if fta is not None else points / 4  # Estimate if not provided
        # Volume factor: 6 FTA = 1.0x, scales linearly
        ft_volume_factor = min(ft_attempts / 6.0, 1.5)  # Cap at 1.5x for high volume
        ft_bonus = (ft_pct - FT_PCT_BASELINE) * ft_volume_factor * 3.0
        fpts += max(ft_bonus, -1.5)  # Cap the penalty

    return round(fpts, 2)


# Position scarcity multipliers
# Centers are scarcer (fewer quality options), guards are deeper
POSITION_SCARCITY: dict[Position, float] = {
    Position.C: 1.15,   # Scarce - premium for quality bigs
    Position.PF: 1.05,  # Slightly scarce
    Position.SF: 1.00,  # Baseline
    Position.SG: 1.00,  # Baseline
    Position.PG: 1.05,  # Slight premium for elite playmakers
}


def calculate_auction_value(
    projected_fpts: float,
    total_budget: float = 200.0,
    roster_size: int = 13,
    player_pool_size: int = 150,
    *,
    replacement_level_percentile: float = 0.6,
) -> float:
    """Calculate auction value based on projected fantasy points (legacy version).

    Uses a value-over-replacement approach:
    1. Estimate replacement-level production (60th percentile of draftable players)
    2. Calculate value above replacement
    3. Scale to auction budget

    Note: Prefer calculate_auction_value_v2() for more accurate values when
    you have access to the full player pool.

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


def calculate_auction_value_v2(
    projected_fpts: float,
    all_player_fpts: Sequence[float],
    position: Position | None = None,
    num_teams: int = 12,
    roster_size: int = 13,
    budget_per_team: float = 200.0,
    games_played: int | None = None,
    age: int | None = None,
    avg_games_played: float | None = None,
    games_played_trend: float | None = None,
) -> float:
    """Z-score based auction value calculation with durability and age adjustments.

    This method:
    1. Identifies draftable pool (top N players where N = teams × roster)
    2. Uses percentile-based value assignment with exponential decay
    3. Applies position scarcity multiplier
    4. Adjusts for durability using multi-season average games played
    5. Applies games-played trajectory penalty (trending down = worse)
    6. Applies exponential age-decline curve for players 33+

    The value distribution follows real auction patterns:
    - Top ~3% of players: $50-75 (elite tier)
    - Top ~15% of players: $25-50 (star tier)
    - Top ~40% of players: $10-25 (starter tier)
    - Bottom ~60%: $1-10 (role/bench tier)

    Args:
        projected_fpts: Player's projected fantasy points per game
        all_player_fpts: Fantasy points for all players in the pool
        position: Player's position (for scarcity multiplier)
        num_teams: Number of teams in the league
        roster_size: Number of roster spots per team
        budget_per_team: Auction budget per team
        games_played: Most recent season games played (durability signal)
        age: Player's age in years (for decline risk adjustment)
        avg_games_played: Multi-season average games played (stronger durability
            signal — captures chronic injury-proneness like AD). Falls back to
            games_played if not provided.
        games_played_trend: Change in games played from prior season to current
            (negative = trending toward fewer games = extra penalty).

    Returns:
        Auction value in dollars (minimum $1, max ~$75)
    """
    if len(all_player_fpts) == 0:
        return 1.0

    # Sort to identify draftable pool
    sorted_fpts = sorted(all_player_fpts, reverse=True)
    draftable_count = num_teams * roster_size  # e.g., 12 teams × 13 roster = 156

    # Get the draftable pool size (or all if pool is smaller)
    pool_size = min(draftable_count, len(sorted_fpts))

    # Find player's rank in the pool
    # Count how many players have higher FPTS
    rank = sum(1 for fpts in all_player_fpts if fpts > projected_fpts)

    # If player is outside draftable pool, minimum value
    if rank >= pool_size:
        return 1.0

    # Calculate percentile within draftable pool (0 = best, 1 = worst draftable)
    percentile = rank / pool_size

    # Value curve: use exponential decay so elite players get premium
    base_value = 1.0
    max_premium = 74.0
    decay_rate = 5.0

    raw_value = base_value + max_premium * math.exp(-decay_rate * percentile)

    # Apply position scarcity multiplier (subtle effect)
    if position is not None:
        scarcity = POSITION_SCARCITY.get(position, 1.0)
        raw_value = raw_value * (0.9 + 0.1 * scarcity)

    # ── Durability adjustment (multi-season aware) ──
    # Use multi-season average GP if available (captures chronic injury-proneness),
    # otherwise fall back to single-season GP.
    # 70+ games = full value, 55 games ≈ 80%, 40 games ≈ 60%, 20 games ≈ 40%
    gp_signal = avg_games_played if avg_games_played is not None else (
        float(games_played) if games_played is not None else None
    )

    if gp_signal is not None:
        full_season_games = 70  # Healthy season threshold (stricter than before)
        min_games_factor = 0.30  # Floor at 30% value

        if gp_signal >= full_season_games:
            games_factor = 1.0
        else:
            # Quadratic scaling — penalizes low GP more aggressively than linear
            # 55 GP: (55/70)^1.3 ≈ 0.71 → factor ≈ 0.30 + 0.70*0.71 = 0.80
            # 40 GP: (40/70)^1.3 ≈ 0.47 → factor ≈ 0.30 + 0.70*0.47 = 0.63
            # 20 GP: (20/70)^1.3 ≈ 0.19 → factor ≈ 0.30 + 0.70*0.19 = 0.43
            games_ratio = gp_signal / full_season_games
            scaled_ratio = math.pow(min(games_ratio, 1.0), 1.3)
            games_factor = min_games_factor + (1.0 - min_games_factor) * scaled_ratio

        raw_value = raw_value * games_factor

    # ── Games-played trajectory penalty ──
    # If a player's GP is trending down year-over-year, apply an extra penalty.
    # A player going from 75→55 GP (-20) is a bigger red flag than steady 55 GP.
    if games_played_trend is not None and games_played_trend < -5:
        # Only penalize meaningful declines (>5 game drop)
        # -10 games: 3% penalty, -20 games: 6% penalty, -30 games: 9% (capped)
        trend_penalty = min(0.09, abs(games_played_trend + 5) * 0.003)
        raw_value = raw_value * (1.0 - trend_penalty)

    # ── Age adjustment (exponential decline curve) ──
    # Exponential curve gives moderate penalties early (33-35), steep penalties
    # late (38+). Reflects that decline accelerates with age.
    #
    # Approximate values:
    # - Age 33: 93% value
    # - Age 35: 80% value
    # - Age 37: 63% value
    # - Age 39: 45% value
    # - Age 40: 38% value (LeBron range)
    # - Floor: 30%
    if age is not None:
        prime_age_cutoff = 33
        if age < prime_age_cutoff:
            age_factor = 1.0
        else:
            years_over_prime = age - prime_age_cutoff
            # Exponential decay: 0.9^years gives ~0.93 at 1yr, ~0.73 at 3yr, ~0.48 at 7yr
            age_factor = max(0.30, math.pow(0.9, years_over_prime))

        raw_value = raw_value * age_factor

    # Apply floor and ceiling
    value = max(1.0, min(round(raw_value, 0), 75.0))

    return value


def calculate_pool_auction_values(
    players: list[dict[str, Any]],
    num_teams: int = 12,
    roster_size: int = 13,
    budget_per_team: float = 200.0,
) -> list[float]:
    """Calculate auction values for an entire player pool.

    This function ensures the total values approximately equal the league budget,
    providing realistic auction prices.

    Args:
        players: List of player dicts with 'projected_fpts' and optionally 'position'
        num_teams: Number of teams in the league
        roster_size: Number of roster spots per team
        budget_per_team: Auction budget per team

    Returns:
        List of auction values corresponding to each player
    """
    all_fpts = [p["projected_fpts"] for p in players]

    values = []
    for player in players:
        position = player.get("position")
        if isinstance(position, str):
            try:
                position = Position(position)
            except ValueError:
                position = None

        value = calculate_auction_value_v2(
            projected_fpts=player["projected_fpts"],
            all_player_fpts=all_fpts,
            position=position,
            num_teams=num_teams,
            roster_size=roster_size,
            budget_per_team=budget_per_team,
        )
        values.append(value)

    return values


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

    Note: This uses the legacy auction value calculation. For more accurate
    pool-aware values, use calculate_player_projections_batch().

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


def calculate_player_projections_batch(
    players_data: list[dict[str, Any]],
    num_teams: int = 12,
    roster_size: int = 13,
    budget_per_team: float = 200.0,
) -> list[PlayerProjection]:
    """Create PlayerProjections for a batch of players with pool-aware auction values.

    This is the preferred method for generating projections as it uses the v2
    z-score based auction values that account for the entire player pool.

    Args:
        players_data: List of player dicts, each with:
            - player_id: str
            - name: str
            - team: str
            - position: str (PG, SG, SF, PF, C)
            - stats: dict with points, rebounds, assists, steals, blocks,
                     turnovers, fg_pct, ft_pct, three_made
        num_teams: Number of teams in the league
        roster_size: Roster spots per team
        budget_per_team: Auction budget per team

    Returns:
        List of PlayerProjection objects with calibrated auction values
    """
    # First pass: calculate fantasy points for all players
    player_fpts: list[tuple[dict[str, Any], float, Position]] = []
    for p in players_data:
        stats = p.get("stats", p)  # Support both nested and flat structures
        fpts = calculate_fantasy_points(
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
        pos_str = p.get("position", "SF")
        pos = Position(pos_str) if isinstance(pos_str, str) else pos_str
        player_fpts.append((p, fpts, pos))

    # Get all fantasy points for z-score calculation
    all_fpts = [fpts for _, fpts, _ in player_fpts]

    # Second pass: create projections with pool-aware auction values
    projections: list[PlayerProjection] = []
    for player_data, fpts, pos in player_fpts:
        stats = player_data.get("stats", player_data)

        auction_value = calculate_auction_value_v2(
            projected_fpts=fpts,
            all_player_fpts=all_fpts,
            position=pos,
            num_teams=num_teams,
            roster_size=roster_size,
            budget_per_team=budget_per_team,
        )

        projection = PlayerProjection(
            id=player_data.get("player_id", player_data.get("id", "")),
            name=player_data.get("name", "Unknown"),
            team=player_data.get("team", "UNK"),
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
            projected_fpts=fpts,
            auction_value=auction_value,
        )
        projections.append(projection)

    return projections
