"""Feature engineering for player projection models.

This module transforms raw player season stats into features suitable
for training XGBoost models to predict next-season performance.

Enhanced with demographics, advanced stats, team context, and derived features
for ~61 total features (up from 33 in the original model).
"""

import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Stats to predict (9 fantasy categories)
STAT_TARGETS = [
    "ppg",
    "rpg",
    "apg",
    "spg",
    "bpg",
    "topg",
    "fg_pct",
    "ft_pct",
    "three_pm",
]

# Position encoding
POSITIONS = ["PG", "SG", "SF", "PF", "C"]

# Advanced stat columns available from enhanced data
ADVANCED_STATS = [
    "usg_pct",
    "ts_pct",
    "net_rating",
    "ast_pct",
    "oreb_pct",
    "dreb_pct",
    "e_off_rating",
    "e_def_rating",
    "e_tov_pct",
]

# Team context columns
TEAM_CONTEXT = [
    "team_e_pace",
    "team_e_off_rating",
    "team_e_def_rating",
]

# Demographic columns
DEMOGRAPHIC_COLS = [
    "age",
    "player_height_inches",
    "draft_round",
    "draft_number",
    "season_exp",
]


def _safe_get(row: Any, col: str, default: float = 0.0) -> float:
    """Safely extract a float value from a row, returning default if missing."""
    try:
        val = row[col]
        if pd.isna(val):
            return default
        return float(val)
    except (KeyError, TypeError):
        return default


def _has_enhanced_data(df: pd.DataFrame) -> bool:
    """Check if the DataFrame contains enhanced columns."""
    enhanced_cols = ADVANCED_STATS + TEAM_CONTEXT + DEMOGRAPHIC_COLS
    return any(col in df.columns for col in enhanced_cols)


class ProjectionFeatureBuilder:
    """Builds training features for player projection models.

    Features include:
    - Previous season stats (season N-1)
    - Two seasons ago stats (season N-2, if available)
    - Career trajectory (improving/declining)
    - Demographics (age, height, draft position, experience)
    - Advanced stats (USG%, TS%, NET_RATING, AST%, OREB%, DREB%)
    - Estimated metrics (E_OFF_RATING, E_DEF_RATING, E_TOV_PCT)
    - Team context (pace, off/def rating)
    - Derived per-minute and per-game rates
    """

    def __init__(self) -> None:
        """Initialize the feature builder."""
        self.feature_columns: list[str] = []

    def _build_features_for_row(
        self,
        prior_row: Any,
        two_prior_row: Any | None,
        has_prev2: bool,
        enhanced: bool,
    ) -> dict[str, Any]:
        """Build the full feature dict for one training/inference example.

        Args:
            prior_row: Season N-1 data (most recent prior season)
            two_prior_row: Season N-2 data (or None)
            has_prev2: Whether real N-2 data is available
            enhanced: Whether enhanced columns exist in the data

        Returns:
            Dictionary of feature name -> value
        """
        features: dict[str, Any] = {}

        # ── Prior season stats (N-1): 11 features ──
        for stat in STAT_TARGETS:
            features[f"prev_{stat}"] = _safe_get(prior_row, stat)
        features["prev_games"] = _safe_get(prior_row, "games_played")
        features["prev_minutes"] = _safe_get(prior_row, "minutes_per_game")

        # ── Two seasons ago stats (N-2): 11 features ──
        if has_prev2 and two_prior_row is not None:
            for stat in STAT_TARGETS:
                features[f"prev2_{stat}"] = _safe_get(two_prior_row, stat)
            features["prev2_games"] = _safe_get(two_prior_row, "games_played")
            features["prev2_minutes"] = _safe_get(two_prior_row, "minutes_per_game")

            # Trajectory (N-2 → N-1): 9 features
            for stat in STAT_TARGETS:
                features[f"trajectory_{stat}"] = (
                    _safe_get(prior_row, stat) - _safe_get(two_prior_row, stat)
                )
        else:
            # No N-2 data — use N-1 stats as placeholder
            for stat in STAT_TARGETS:
                features[f"prev2_{stat}"] = _safe_get(prior_row, stat)
                features[f"trajectory_{stat}"] = 0.0
            features["prev2_games"] = _safe_get(prior_row, "games_played")
            features["prev2_minutes"] = _safe_get(prior_row, "minutes_per_game")

        # Flag: 1 feature
        features["has_prev2_data"] = 1 if has_prev2 else 0

        # ── Enhanced features (only if data is available) ──
        if enhanced:
            # Demographics: 5 features
            features["age"] = _safe_get(prior_row, "age")
            features["height_inches"] = _safe_get(prior_row, "player_height_inches")
            features["draft_round"] = _safe_get(prior_row, "draft_round")
            features["draft_number"] = _safe_get(prior_row, "draft_number")
            features["season_exp"] = _safe_get(prior_row, "season_exp")

            # Advanced N-1: 9 features
            for stat in ADVANCED_STATS:
                features[f"prev_{stat}"] = _safe_get(prior_row, stat)

            # Team context N-1: 3 features
            for stat in TEAM_CONTEXT:
                features[f"prev_{stat}"] = _safe_get(prior_row, stat)

            # Derived features: 8 features
            prev_minutes = _safe_get(prior_row, "minutes_per_game", default=1.0)
            if prev_minutes <= 0:
                prev_minutes = 1.0

            features["prev_per_minute_ppg"] = (
                _safe_get(prior_row, "ppg") / prev_minutes
            )
            features["prev_per_minute_rpg"] = (
                _safe_get(prior_row, "rpg") / prev_minutes
            )
            features["prev_per_minute_apg"] = (
                _safe_get(prior_row, "apg") / prev_minutes
            )

            # Games played as fraction of full season (82 games)
            features["prev_games_pct"] = _safe_get(prior_row, "games_played") / 82.0

            # Minutes trajectory
            if has_prev2 and two_prior_row is not None:
                features["minutes_trajectory"] = (
                    _safe_get(prior_row, "minutes_per_game")
                    - _safe_get(two_prior_row, "minutes_per_game")
                )
            else:
                features["minutes_trajectory"] = 0.0

            # Team change flag
            features["changed_team"] = _safe_get(prior_row, "changed_team")

            # Volume indicators
            features["prev_fga"] = _safe_get(prior_row, "fga")
            features["prev_fta"] = _safe_get(prior_row, "fta")

            # Advanced trajectory: 4 features
            if has_prev2 and two_prior_row is not None:
                features["trajectory_usg_pct"] = (
                    _safe_get(prior_row, "usg_pct") - _safe_get(two_prior_row, "usg_pct")
                )
                features["trajectory_ts_pct"] = (
                    _safe_get(prior_row, "ts_pct") - _safe_get(two_prior_row, "ts_pct")
                )
                features["trajectory_net_rating"] = (
                    _safe_get(prior_row, "net_rating")
                    - _safe_get(two_prior_row, "net_rating")
                )
                features["trajectory_minutes"] = (
                    _safe_get(prior_row, "minutes_per_game")
                    - _safe_get(two_prior_row, "minutes_per_game")
                )
            else:
                features["trajectory_usg_pct"] = 0.0
                features["trajectory_ts_pct"] = 0.0
                features["trajectory_net_rating"] = 0.0
                features["trajectory_minutes"] = 0.0

        return features

    def build_training_data(
        self,
        player_seasons: pd.DataFrame,
        target_stats: list[str] | None = None,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        """Create features and targets for training.

        For each player-season, creates features from prior seasons
        to predict that season's stats.

        Args:
            player_seasons: DataFrame with columns:
                - PLAYER_ID: Unique player identifier
                - PLAYER_NAME: Player name
                - SEASON: Season string (e.g., "2023-24")
                - games_played, minutes_per_game
                - ppg, rpg, apg, spg, bpg, topg, fg_pct, ft_pct, three_pm
                - (optional) enhanced columns from get_enhanced_projection_data
            target_stats: Stats to predict (defaults to STAT_TARGETS)

        Returns:
            Tuple of (X, y) where:
            - X: DataFrame of features for each training example
            - y: DataFrame of target stats for each training example
        """
        if target_stats is None:
            target_stats = STAT_TARGETS

        enhanced = _has_enhanced_data(player_seasons)

        # Sort by player and season
        df = player_seasons.copy()
        df = df.sort_values(["PLAYER_ID", "SEASON"])

        # Build features for each player-season
        features_list: list[dict[str, Any]] = []
        targets_list: list[dict[str, float]] = []

        for player_id in df["PLAYER_ID"].unique():
            player_data = df[df["PLAYER_ID"] == player_id].copy()

            # Need at least 2 seasons (1 prior + 1 to predict)
            if len(player_data) < 2:
                continue

            seasons = player_data["SEASON"].tolist()

            # For each season (except the first), use prior season(s) as features
            for i in range(1, len(seasons)):
                target_season = seasons[i]
                prior_season = seasons[i - 1]

                target_row = player_data[player_data["SEASON"] == target_season].iloc[0]
                prior_row = player_data[player_data["SEASON"] == prior_season].iloc[0]

                has_prev2 = i >= 2
                two_prior_row = None
                if has_prev2:
                    two_prior_season = seasons[i - 2]
                    two_prior_row = player_data[
                        player_data["SEASON"] == two_prior_season
                    ].iloc[0]

                features = self._build_features_for_row(
                    prior_row=prior_row,
                    two_prior_row=two_prior_row,
                    has_prev2=has_prev2,
                    enhanced=enhanced,
                )
                features["player_id"] = player_id
                features["target_season"] = target_season

                # Build targets
                targets: dict[str, float] = {}
                for stat in target_stats:
                    targets[stat] = float(target_row[stat])

                features_list.append(features)
                targets_list.append(targets)

        if not features_list:
            logger.warning("No training data generated - not enough player history")
            return pd.DataFrame(), pd.DataFrame()

        X = pd.DataFrame(features_list)
        y = pd.DataFrame(targets_list)

        # Store feature columns (excluding metadata)
        self.feature_columns = [
            c for c in X.columns if c not in ["player_id", "target_season"]
        ]

        logger.info(
            f"Built training data: {len(X)} examples, {len(self.feature_columns)} features"
            f" (enhanced={enhanced})"
        )

        return X, y

    def build_inference_features(
        self,
        current_season_stats: pd.DataFrame,
        prior_season_stats: pd.DataFrame | None = None,
    ) -> pd.DataFrame:
        """Build features for predicting next season.

        Args:
            current_season_stats: Most recent season stats (becomes N-1)
            prior_season_stats: Two seasons ago stats (becomes N-2, optional)

        Returns:
            DataFrame with features for each player
        """
        enhanced = _has_enhanced_data(current_season_stats)
        features_list: list[dict[str, Any]] = []

        for _, row in current_season_stats.iterrows():
            player_id = row["PLAYER_ID"]

            # Look for N-2 data
            prior_row = None
            has_prev2 = False
            if prior_season_stats is not None:
                prior_matches = prior_season_stats[
                    prior_season_stats["PLAYER_ID"] == player_id
                ]
                if not prior_matches.empty:
                    prior_row = prior_matches.iloc[0]
                    has_prev2 = True

            features = self._build_features_for_row(
                prior_row=row,  # current season = N-1
                two_prior_row=prior_row,  # prior season = N-2
                has_prev2=has_prev2,
                enhanced=enhanced,
            )
            features["player_id"] = player_id

            features_list.append(features)

        return pd.DataFrame(features_list)

    def get_feature_matrix(self, X: pd.DataFrame) -> np.ndarray[tuple[Any, ...], np.dtype[np.float32]]:
        """Extract numeric feature matrix from DataFrame.

        Args:
            X: DataFrame with features

        Returns:
            NumPy array with feature values
        """
        if not self.feature_columns:
            # Infer feature columns if not set
            self.feature_columns = [
                c for c in X.columns if c not in ["player_id", "target_season"]
            ]

        # Only use feature columns that exist in X (backward compatibility)
        available_cols = [c for c in self.feature_columns if c in X.columns]
        if len(available_cols) < len(self.feature_columns):
            missing = set(self.feature_columns) - set(available_cols)
            logger.warning(
                f"Missing {len(missing)} feature columns, filling with 0: "
                f"{sorted(missing)[:5]}..."
            )
            # Add missing columns with zeros
            for col in missing:
                X = X.copy()
                X[col] = 0.0

        result: np.ndarray[tuple[Any, ...], np.dtype[np.float32]] = (
            X[self.feature_columns].values.astype(np.float32)
        )
        return result
