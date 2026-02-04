"""Load real NBA player data for the draft room.

This module bridges the NBA API data to the draft optimizer,
creating PlayerProjection objects with real stats and accurate auction values.
"""

import logging
from datetime import datetime
from typing import Any

import pandas as pd

from draft_optimizer.features import (
    calculate_auction_value_v2,
    calculate_fantasy_points,
)
from draft_optimizer.schemas import PlayerProjection, Position

logger = logging.getLogger(__name__)


def fetch_player_ages(player_ids: list[int]) -> dict[int, int]:
    """Fetch player ages from NBA API.

    Args:
        player_ids: List of NBA player IDs

    Returns:
        Dictionary mapping player_id -> age in years
    """
    from nba_api.stats.endpoints import commonallplayers

    logger.info("Fetching player age data...")

    try:
        # Get all current players (includes FROM_YEAR which we can use to estimate age)
        all_players = commonallplayers.CommonAllPlayers(
            is_only_current_season=1,
            league_id="00",
        ).get_data_frames()[0]

        # Create lookup by player ID
        player_lookup = {
            row["PERSON_ID"]: row for _, row in all_players.iterrows()
        }

        ages: dict[int, int] = {}
        current_year = datetime.now().year

        for pid in player_ids:
            if pid in player_lookup:
                player = player_lookup[pid]
                # Use FROM_YEAR (rookie year) to estimate age
                # Average NBA player enters at ~20 years old
                from_year = player.get("FROM_YEAR")
                if from_year and str(from_year).isdigit():
                    rookie_year = int(from_year)
                    # Estimate: entered league at ~20, current age = 20 + (current_year - rookie_year)
                    estimated_age = 20 + (current_year - rookie_year)
                    ages[pid] = estimated_age

        logger.info(f"Fetched ages for {len(ages)} players")
        return ages

    except Exception as e:
        logger.warning(f"Failed to fetch player ages: {e}")
        return {}

# Map NBA positions to our Position enum
# NBA API uses various formats like "Guard", "G", "PG-SG", etc.
POSITION_MAP: dict[str, Position] = {
    "G": Position.PG,
    "F": Position.SF,
    "C": Position.C,
    "G-F": Position.SG,
    "F-G": Position.SF,
    "F-C": Position.PF,
    "C-F": Position.C,
}


def infer_position_from_stats(row: dict[str, Any]) -> Position:
    """Infer position from stat profile when position data is missing.

    Uses heuristics based on stat profiles typical of each position.
    Priority: rebounds-based classification first (for big men), then assists.
    """
    apg = row.get("apg", 0) or 0
    rpg = row.get("rpg", 0) or 0
    bpg = row.get("bpg", 0) or 0
    spg = row.get("spg", 0) or 0
    three_pm = row.get("three_pm", 0) or 0
    ppg = row.get("ppg", 0) or 0

    # BIG MEN FIRST (check rebounds before assists)
    # This ensures Jokic (13 rpg, 9 apg) is classified as C not PG

    # Centers: very high rebounds (12+) regardless of assists
    # Examples: Jokic (13 rpg, 9 apg), Embiid (11 rpg, 5 apg), Gobert (13 rpg)
    if rpg >= 11:
        return Position.C

    # Centers/PF: high rebounds + blocks
    # Examples: AD (12 rpg, 2 bpg), Wembanyama (11 rpg, 4 bpg)
    if rpg >= 9 and bpg >= 1.0:
        return Position.C

    # Power forwards: high rebounds, moderate blocks
    # Examples: Giannis (11 rpg, 1.5 bpg), KAT (9 rpg)
    if rpg >= 8:
        return Position.PF

    # GUARDS (check assists after ruling out big men)

    # Point guards: high assists, lower rebounds
    # Examples: Haliburton (8+ apg), Trae Young (11 apg), Cade (9 apg)
    if apg >= 6 and rpg < 7:
        return Position.PG

    # Shooting guards: scoring focus, moderate assists, good 3PT
    # Examples: Booker (27 ppg, 4 apg), Edwards (26 ppg, 5 apg)
    if ppg >= 18 and three_pm >= 2 and apg < 6:
        return Position.SG

    # Small forwards: balanced stats
    # Examples: Tatum (27 ppg, 9 rpg, 5 apg), KD (27 ppg, 6 rpg, 4 apg)
    if ppg >= 15 and rpg >= 5 and apg >= 3:
        return Position.SF

    # Playmaking guards
    if apg >= 5:
        return Position.PG

    # Scoring guards
    if spg >= 1.0 and three_pm >= 1.5:
        return Position.SG

    # Default based on rebounds vs assists ratio
    if rpg >= 6:
        return Position.PF
    elif apg >= 4:
        return Position.PG
    else:
        return Position.SF


def load_real_players_from_api(
    season: str = "2024-25",
    min_games: int = 20,
    min_minutes: float = 15.0,
    include_age_adjustment: bool = True,
) -> list[PlayerProjection]:
    """Load real NBA players from the NBA API.

    Fetches current season data, calculates fantasy points with volume weighting,
    and generates auction values with games-played and age adjustments.

    Args:
        season: NBA season (e.g., "2024-25")
        min_games: Minimum games played to include
        min_minutes: Minimum minutes per game to include
        include_age_adjustment: Whether to apply age-based value penalty

    Returns:
        List of PlayerProjection objects with real data
    """
    from core.services.player_stats_service import PlayerStatsService

    logger.info(f"Loading real NBA players for season {season}")

    # Fetch and aggregate data
    service = PlayerStatsService()
    game_logs = service.fetch_seasons([season])

    if game_logs.empty:
        logger.error("No game logs fetched from NBA API")
        return []

    season_stats = service.aggregate_season_averages(game_logs)

    # Filter by minimum games and minutes
    filtered = season_stats[
        (season_stats["games_played"] >= min_games)
        & (season_stats["minutes_per_game"] >= min_minutes)
    ].copy()

    logger.info(
        f"Filtered to {len(filtered)} players (min {min_games} games, {min_minutes} mpg)"
    )

    if filtered.empty:
        return []

    # Fetch player ages if enabled
    player_ages: dict[int, int] = {}
    if include_age_adjustment:
        player_ids = filtered["PLAYER_ID"].astype(int).tolist()
        player_ages = fetch_player_ages(player_ids)

    # Calculate fantasy points for all players (with volume weighting)
    fpts_list = []
    for _, row in filtered.iterrows():
        fpts = calculate_fantasy_points(
            points=row["ppg"],
            rebounds=row["rpg"],
            assists=row["apg"],
            steals=row["spg"],
            blocks=row["bpg"],
            turnovers=row["topg"],
            fg_pct=row["fg_pct"],
            ft_pct=row["ft_pct"],
            three_made=row["three_pm"],
            fga=row.get("fga"),  # Volume weighting for FG%
            fta=row.get("fta"),  # Volume weighting for FT%
        )
        fpts_list.append(fpts)

    filtered["projected_fpts"] = fpts_list
    all_fpts = filtered["projected_fpts"].tolist()

    # Create PlayerProjection objects
    players: list[PlayerProjection] = []

    for _, row in filtered.iterrows():
        # Infer position from stats (NBA API doesn't always include position)
        position = infer_position_from_stats(row.to_dict())

        # Get player age if available
        player_id = int(row["PLAYER_ID"])
        age = player_ages.get(player_id)

        # Calculate auction value with games-played AND age adjustment
        auction_value = calculate_auction_value_v2(
            projected_fpts=row["projected_fpts"],
            all_player_fpts=all_fpts,
            position=position,
            games_played=int(row["games_played"]),
            age=age,
        )

        player = PlayerProjection(
            id=f"nba_{row['PLAYER_ID']}",
            name=row["PLAYER_NAME"],
            team=row.get("TEAM", "UNK"),
            position=position,
            points=row["ppg"],
            rebounds=row["rpg"],
            assists=row["apg"],
            steals=row["spg"],
            blocks=row["bpg"],
            turnovers=row["topg"],
            fg_pct=row["fg_pct"],
            ft_pct=row["ft_pct"],
            three_made=row["three_pm"],
            projected_fpts=row["projected_fpts"],
            auction_value=auction_value,
        )
        players.append(player)

    # Sort by auction value descending
    players.sort(key=lambda p: -p.auction_value)

    logger.info(f"Created {len(players)} player projections from real data")

    # Log top 10 for verification
    logger.info("Top 10 players by auction value:")
    for p in players[:10]:
        logger.info(
            f"  ${p.auction_value:3.0f} - {p.name} ({p.team}) - "
            f"{p.projected_fpts:.1f} FPTS"
        )

    return players


def load_real_players_from_dataframe(
    season_stats: pd.DataFrame,
    num_teams: int = 12,
    roster_size: int = 13,
    budget_per_team: float = 200.0,
) -> list[PlayerProjection]:
    """Create PlayerProjection objects from a pre-fetched DataFrame.

    Useful when you've already fetched data via PlayerStatsService.

    Args:
        season_stats: DataFrame from PlayerStatsService.aggregate_season_averages()
        num_teams: League size
        roster_size: Roster spots per team
        budget_per_team: Auction budget

    Returns:
        List of PlayerProjection objects
    """
    if season_stats.empty:
        return []

    # Calculate fantasy points for all players
    fpts_list = []
    for _, row in season_stats.iterrows():
        fpts = calculate_fantasy_points(
            points=row["ppg"],
            rebounds=row["rpg"],
            assists=row["apg"],
            steals=row["spg"],
            blocks=row["bpg"],
            turnovers=row["topg"],
            fg_pct=row["fg_pct"],
            ft_pct=row["ft_pct"],
            three_made=row["three_pm"],
        )
        fpts_list.append(fpts)

    season_stats = season_stats.copy()
    season_stats["projected_fpts"] = fpts_list
    all_fpts = season_stats["projected_fpts"].tolist()

    # Create PlayerProjection objects
    players: list[PlayerProjection] = []

    for _, row in season_stats.iterrows():
        position = infer_position_from_stats(row.to_dict())

        auction_value = calculate_auction_value_v2(
            projected_fpts=row["projected_fpts"],
            all_player_fpts=all_fpts,
            position=position,
            num_teams=num_teams,
            roster_size=roster_size,
            budget_per_team=budget_per_team,
            games_played=int(row["games_played"]),
        )

        player = PlayerProjection(
            id=f"nba_{row['PLAYER_ID']}",
            name=row["PLAYER_NAME"],
            team=row.get("TEAM", "UNK"),
            position=position,
            points=row["ppg"],
            rebounds=row["rpg"],
            assists=row["apg"],
            steals=row["spg"],
            blocks=row["bpg"],
            turnovers=row["topg"],
            fg_pct=row["fg_pct"],
            ft_pct=row["ft_pct"],
            three_made=row["three_pm"],
            projected_fpts=row["projected_fpts"],
            auction_value=auction_value,
        )
        players.append(player)

    players.sort(key=lambda p: -p.auction_value)
    return players
