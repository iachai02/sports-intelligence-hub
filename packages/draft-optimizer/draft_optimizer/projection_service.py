"""Projection service: connects trained XGBoost model to draft room.

Loads the model once per server lifecycle, fetches recent seasons from NBA API,
runs inference with enhanced features (~61), applies mid-season blending when
partial current-season data exists, and returns PlayerProjection objects.
"""

import logging
from pathlib import Path

from draft_optimizer.features import (
    calculate_auction_value_v2,
    calculate_fantasy_points,
)
from draft_optimizer.ml.features import STAT_TARGETS, ProjectionFeatureBuilder
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


def blend_mid_season(
    xgb_predictions: dict[str, float],
    current_actuals: dict[str, float],
    games_played: int,
) -> dict[str, float]:
    """Blend XGBoost projection with current-season actuals.

    When the target season has partial actual data, blend the model projection
    with current actuals. More games -> heavier weight on actuals, with a 15%
    floor for the historical projection to stabilize against recency bias.

    Args:
        xgb_predictions: Model-predicted stats for the full season
        current_actuals: Actual per-game stats so far this season
        games_played: Number of games played in the current season

    Returns:
        Blended stat predictions
    """
    # Weight formula: linear ramp to 85% cap at 50 games
    current_weight = min(0.85, games_played / 50.0)
    historical_weight = 1.0 - current_weight

    blended: dict[str, float] = {}
    for stat in STAT_TARGETS:
        xgb_val = xgb_predictions.get(stat, 0.0)
        actual_val = current_actuals.get(stat, 0.0)
        blended[stat] = round(
            current_weight * actual_val + historical_weight * xgb_val, 3
        )

    return blended


def load_projected_players(
    target_season: str = "2025-26",
    min_games: int = 20,
) -> list[PlayerProjection]:
    """Generate projected stats for all qualifying players.

    Uses the two most recent actual seasons as input features:
    - current_season (2024-25) -> N-1 features
    - prior_season (2023-24) -> N-2 features

    If the target season has partial actual data available, mid-season
    blending is applied automatically.

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

    service = PlayerStatsService()

    # Try enhanced data first, fall back to basic if advanced endpoints fail
    used_enhanced = False
    try:
        all_data = service.get_enhanced_projection_data(
            seasons=["2023-24", "2024-25"],
            min_games=min_games,
        )
        used_enhanced = True
    except Exception as e:
        logger.warning(f"Enhanced data fetch failed, falling back to basic: {e}")
        all_data = service.get_projection_ready_data(
            seasons=["2023-24", "2024-25"],
            min_games=min_games,
        )

    if all_data.empty:
        logger.error("No data fetched for projection input seasons")
        return []

    # Diagnostic logging — helps debug silent failures in enhanced pipeline
    logger.info(
        f"Data source: {'enhanced' if used_enhanced else 'basic'}, "
        f"columns ({len(all_data.columns)}): {sorted(all_data.columns.tolist())}"
    )
    if "age" in all_data.columns:
        non_null = all_data["age"].notna().sum()
        logger.info(f"Age column present: {non_null}/{len(all_data)} non-null values")
    else:
        logger.warning("Age column MISSING — age adjustments will be skipped")

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

    # Build inference features (model's config.json selects which features to use)
    projector = _get_projector()
    feature_builder = ProjectionFeatureBuilder()
    feature_builder.feature_columns = projector.feature_builder.feature_columns

    features = feature_builder.build_inference_features(
        current_season_stats=current_season,
        prior_season_stats=prior_season if not prior_season.empty else None,
    )

    # Run predictions
    predictions = projector.predict(features)

    # Mid-season blending: check if the target season has partial actual data
    mid_season_actuals: dict[int, dict[str, float]] = {}
    mid_season_games: dict[int, int] = {}

    try:
        target_data = service.get_projection_ready_data(
            seasons=[target_season],
            min_games=1,  # Include anyone with at least 1 game
        )
        if not target_data.empty:
            logger.info(
                f"Mid-season data found: {len(target_data)} players with "
                f"{target_season} stats — applying blending"
            )
            for _, row in target_data.iterrows():
                pid = row["PLAYER_ID"]
                mid_season_actuals[pid] = {
                    stat: float(row[stat]) for stat in STAT_TARGETS
                }
                mid_season_games[pid] = int(row["games_played"])
    except Exception as e:
        logger.debug(f"No mid-season data for {target_season}: {e}")

    # Pre-compute multi-season games played averages and trends per player.
    # This captures chronic injury-proneness (e.g. AD averaging ~55 GP over
    # multiple years) rather than relying on a single season snapshot.
    prior_gp_lookup: dict[object, float] = {}
    for _, prow in prior_season.iterrows():
        prior_gp_lookup[prow["PLAYER_ID"]] = float(prow["games_played"])

    # Build PlayerProjection objects
    # First pass: calculate FPTS for all players (needed for pool-aware auction values)
    player_data: list[tuple[dict[str, float], float, int, dict[str, object]]] = []

    for idx, (_, row) in enumerate(current_season.iterrows()):
        preds = predictions[idx]
        pid = row["PLAYER_ID"]

        # Apply mid-season blending if available
        if pid in mid_season_actuals:
            preds = blend_mid_season(
                xgb_predictions=preds,
                current_actuals=mid_season_actuals[pid],
                games_played=mid_season_games[pid],
            )

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

        # Compute multi-season GP average and trend for this player
        current_gp = float(row["games_played"])
        prior_gp = prior_gp_lookup.get(pid)

        if prior_gp is not None:
            avg_gp = (current_gp + prior_gp) / 2.0
            gp_trend = current_gp - prior_gp  # negative = declining
        else:
            avg_gp = current_gp
            gp_trend = None

        player_data.append((
            preds,
            fpts,
            idx,
            {
                "PLAYER_ID": row["PLAYER_ID"],
                "PLAYER_NAME": row["PLAYER_NAME"],
                "TEAM": row.get("TEAM", "UNK"),
                "games_played": row["games_played"],
                "age": row.get("age"),
                "avg_games_played": avg_gp,
                "games_played_trend": gp_trend,
            },
        ))

    all_fpts = [fpts for _, fpts, _, _ in player_data]

    # Second pass: create projections with pool-aware auction values
    players: list[PlayerProjection] = []

    for preds, fpts, _idx, info in player_data:
        position = infer_position_from_stats(preds)

        # Pass age for decline-risk adjustment (available from enhanced data)
        player_age = info.get("age")
        age_int: int | None = None
        if player_age is not None:
            try:
                age_val = float(str(player_age))
                if age_val == age_val:  # NaN check
                    age_int = int(age_val)
            except (ValueError, TypeError):
                pass

        # Multi-season GP average and trend
        avg_gp_val = info.get("avg_games_played")
        avg_gp_float: float | None = float(str(avg_gp_val)) if avg_gp_val is not None else None

        gp_trend_val = info.get("games_played_trend")
        gp_trend_float: float | None = float(str(gp_trend_val)) if gp_trend_val is not None else None

        auction_value = calculate_auction_value_v2(
            projected_fpts=fpts,
            all_player_fpts=all_fpts,
            position=position,
            games_played=int(str(info["games_played"])),
            age=age_int,
            avg_games_played=avg_gp_float,
            games_played_trend=gp_trend_float,
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
