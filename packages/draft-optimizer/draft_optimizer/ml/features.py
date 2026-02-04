"""Feature engineering for player projection models.

This module transforms raw player season stats into features suitable
for training XGBoost models to predict next-season performance.
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


class ProjectionFeatureBuilder:
    """Builds training features for player projection models.

    Features include:
    - Previous season stats (season N-1)
    - Two seasons ago stats (season N-2, if available)
    - Age and experience indicators
    - Career trajectory (improving/declining)
    """

    def __init__(self) -> None:
        """Initialize the feature builder."""
        self.feature_columns: list[str] = []

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
            target_stats: Stats to predict (defaults to STAT_TARGETS)

        Returns:
            Tuple of (X, y) where:
            - X: DataFrame of features for each training example
            - y: DataFrame of target stats for each training example
        """
        if target_stats is None:
            target_stats = STAT_TARGETS

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

                # Build features from prior season
                features: dict[str, Any] = {
                    "player_id": player_id,
                    "target_season": target_season,
                }

                # Prior season stats (N-1)
                for stat in STAT_TARGETS:
                    features[f"prev_{stat}"] = prior_row[stat]

                # Prior season context
                features["prev_games"] = prior_row["games_played"]
                features["prev_minutes"] = prior_row["minutes_per_game"]

                # Two seasons ago (N-2) if available
                if i >= 2:
                    two_prior_season = seasons[i - 2]
                    two_prior_row = player_data[
                        player_data["SEASON"] == two_prior_season
                    ].iloc[0]

                    for stat in STAT_TARGETS:
                        features[f"prev2_{stat}"] = two_prior_row[stat]

                    features["prev2_games"] = two_prior_row["games_played"]
                    features["prev2_minutes"] = two_prior_row["minutes_per_game"]

                    # Calculate trajectory (change from N-2 to N-1)
                    for stat in STAT_TARGETS:
                        change = prior_row[stat] - two_prior_row[stat]
                        features[f"trajectory_{stat}"] = change
                else:
                    # No N-2 data - use N-1 stats as placeholder
                    for stat in STAT_TARGETS:
                        features[f"prev2_{stat}"] = prior_row[stat]
                        features[f"trajectory_{stat}"] = 0.0

                    features["prev2_games"] = prior_row["games_played"]
                    features["prev2_minutes"] = prior_row["minutes_per_game"]

                features["has_prev2_data"] = 1 if i >= 2 else 0

                # Build targets
                targets: dict[str, float] = {}
                for stat in target_stats:
                    targets[stat] = target_row[stat]

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
        features_list: list[dict[str, Any]] = []

        for _, row in current_season_stats.iterrows():
            player_id = row["PLAYER_ID"]
            features: dict[str, Any] = {
                "player_id": player_id,
            }

            # Current season becomes N-1 features
            for stat in STAT_TARGETS:
                features[f"prev_{stat}"] = row[stat]

            features["prev_games"] = row["games_played"]
            features["prev_minutes"] = row["minutes_per_game"]

            # Look for N-2 data
            prior_row = None
            if prior_season_stats is not None:
                prior_matches = prior_season_stats[
                    prior_season_stats["PLAYER_ID"] == player_id
                ]
                if not prior_matches.empty:
                    prior_row = prior_matches.iloc[0]

            if prior_row is not None:
                for stat in STAT_TARGETS:
                    features[f"prev2_{stat}"] = prior_row[stat]
                    features[f"trajectory_{stat}"] = row[stat] - prior_row[stat]

                features["prev2_games"] = prior_row["games_played"]
                features["prev2_minutes"] = prior_row["minutes_per_game"]
                features["has_prev2_data"] = 1
            else:
                # No prior data - use current as placeholder
                for stat in STAT_TARGETS:
                    features[f"prev2_{stat}"] = row[stat]
                    features[f"trajectory_{stat}"] = 0.0

                features["prev2_games"] = row["games_played"]
                features["prev2_minutes"] = row["minutes_per_game"]
                features["has_prev2_data"] = 0

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

        result: np.ndarray[tuple[Any, ...], np.dtype[np.float32]] = X[self.feature_columns].values.astype(np.float32)
        return result
