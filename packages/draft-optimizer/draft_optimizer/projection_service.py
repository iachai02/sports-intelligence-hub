"""Projection service: connects trained XGBoost model to draft room.

Loads the model once per server lifecycle, fetches recent seasons from NBA API,
runs inference, and returns PlayerProjection objects with predicted stats.
"""

import logging
from pathlib import Path

from draft_optimizer.features import (
    calculate_auction_value_v2,
    calculate_fantasy_points,
)
from draft_optimizer.ml.features import ProjectionFeatureBuilder
from draft_optimizer.ml.projector import XGBoostProjector
from draft_optimizer.real_data import infer_position_from_stats
from draft_optimizer.schemas import PlayerProjection

logger = logging.getLogger(__name__)

# Lazy singleton for the XGBoost projector
_projector: XGBoostProjector | None = None

# Default model path relative to repo root
_MODEL_DIR = Path(__file__).resolve().parents[3] / "models" / "player_projector"

# Cache for projected player pools keyed by target_season
_projected_pool_cache: dict[str, list[PlayerProjection]] = {}


def _get_projector() -> XGBoostProjector:
    """Return a singleton XGBoostProjector, loading from disk on first call."""
    global _projector
    if _projector is None:
        model_path = str(_MODEL_DIR)
        logger.info(f"Loading XGBoost projector from {model_path}")
        _projector = XGBoostProjector(use_mlflow=False)
        _projector.load_model(model_path)
    return _projector


def load_projected_players(
    target_season: str = "2025-26",
    min_games: int = 20,
) -> list[PlayerProjection]:
    """Generate projected stats for all qualifying players.

    Uses the two most recent actual seasons as input features:
    - current_season (2024-25) -> N-1 features
    - prior_season (2023-24) -> N-2 features

    Players with only one season of data still get projections
    (with has_prev2_data=0), matching the model's training.

    Args:
        target_season: The season being projected (e.g. "2025-26")
        min_games: Minimum games played in the current season to include

    Returns:
        List of PlayerProjection objects sorted by auction value descending
    """
    if target_season in _projected_pool_cache:
        return _projected_pool_cache[target_season]

    from core.services.player_stats_service import PlayerStatsService

    logger.info(f"Generating projections for {target_season}")

    # Fetch the two prior seasons
    service = PlayerStatsService()
    all_data = service.get_projection_ready_data(
        seasons=["2023-24", "2024-25"],
        min_games=min_games,
    )

    if all_data.empty:
        logger.error("No data fetched for projection input seasons")
        return []

    # Split into current and prior season DataFrames
    current_season = all_data[all_data["SEASON"] == "2024-25"].copy()
    prior_season = all_data[all_data["SEASON"] == "2023-24"].copy()

    if current_season.empty:
        logger.error("No 2024-25 data available for projections")
        return []

    logger.info(
        f"Projection input: {len(current_season)} current-season players, "
        f"{len(prior_season)} prior-season players"
    )

    # Build inference features (33-feature DataFrame)
    projector = _get_projector()
    feature_builder = ProjectionFeatureBuilder()
    feature_builder.feature_columns = projector.feature_builder.feature_columns

    features = feature_builder.build_inference_features(
        current_season_stats=current_season,
        prior_season_stats=prior_season if not prior_season.empty else None,
    )

    # Run predictions
    predictions = projector.predict(features)

    # Build PlayerProjection objects
    # First pass: calculate FPTS for all players (needed for pool-aware auction values)
    player_data: list[tuple[dict[str, float], float, int, dict[str, object]]] = []

    for idx, (_, row) in enumerate(current_season.iterrows()):
        preds = predictions[idx]

        fpts = calculate_fantasy_points(
            points=preds["ppg"],
            rebounds=preds["rpg"],
            assists=preds["apg"],
            steals=preds["spg"],
            blocks=preds["bpg"],
            turnovers=preds["topg"],
            fg_pct=preds["fg_pct"],
            ft_pct=preds["ft_pct"],
            three_made=preds["three_pm"],
        )

        player_data.append((
            preds,
            fpts,
            idx,
            {
                "PLAYER_ID": row["PLAYER_ID"],
                "PLAYER_NAME": row["PLAYER_NAME"],
                "TEAM": row.get("TEAM", "UNK"),
                "games_played": row["games_played"],
            },
        ))

    all_fpts = [fpts for _, fpts, _, _ in player_data]

    # Second pass: create projections with pool-aware auction values
    players: list[PlayerProjection] = []

    for preds, fpts, _idx, info in player_data:
        position = infer_position_from_stats(preds)

        auction_value = calculate_auction_value_v2(
            projected_fpts=fpts,
            all_player_fpts=all_fpts,
            position=position,
            games_played=int(str(info["games_played"])),
        )

        player = PlayerProjection(
            id=f"nba_{info['PLAYER_ID']}",
            name=str(info["PLAYER_NAME"]),
            team=str(info["TEAM"]),
            position=position,
            points=preds["ppg"],
            rebounds=preds["rpg"],
            assists=preds["apg"],
            steals=preds["spg"],
            blocks=preds["bpg"],
            turnovers=preds["topg"],
            fg_pct=preds["fg_pct"],
            ft_pct=preds["ft_pct"],
            three_made=preds["three_pm"],
            projected_fpts=fpts,
            auction_value=auction_value,
        )
        players.append(player)

    players.sort(key=lambda p: -p.auction_value)

    logger.info(f"Generated {len(players)} projected players for {target_season}")
    if players:
        logger.info("Top 5 projected players:")
        for p in players[:5]:
            logger.info(
                f"  ${p.auction_value:3.0f} - {p.name} ({p.team}) - "
                f"{p.projected_fpts:.1f} FPTS"
            )

    _projected_pool_cache[target_season] = players
    return players
