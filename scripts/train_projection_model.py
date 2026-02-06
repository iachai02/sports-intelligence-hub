"""Training script for enhanced player projection model.

Usage:
    uv run python scripts/train_projection_model.py              # Train + save
    uv run python scripts/train_projection_model.py --backtest   # Train + holdout eval
    uv run python scripts/train_projection_model.py --tune       # Optuna hyperparameter search
"""

import argparse
import json
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Ensure packages are importable
sys.path.insert(0, str(Path(__file__).resolve().parents[0].parent))

from draft_optimizer.ml.features import STAT_TARGETS, ProjectionFeatureBuilder
from draft_optimizer.ml.projector import XGBoostProjector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parents[0].parent / "models" / "player_projector"

# All 5 seasons for training + holdout
ALL_SEASONS = ["2020-21", "2021-22", "2022-23", "2023-24", "2024-25"]

# Temporal split: train on earlier seasons, test on latest
TRAIN_SEASONS = ["2020-21", "2021-22", "2022-23", "2023-24"]
TEST_TARGET_SEASON = "2024-25"

# Default enhanced hyperparameters (more regularized for more features)
ENHANCED_PARAMS = {
    "n_estimators": 150,
    "max_depth": 4,
    "learning_rate": 0.08,
    "min_child_weight": 5,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.1,
    "reg_lambda": 1.0,
    "random_state": 42,
    "n_jobs": -1,
}

# Spot-check players (name substrings to match)
SPOT_CHECK_PLAYERS = [
    "Wembanyama",
    "Jokic",
    "Doncic",
    "Gilgeous-Alexander",
    "Tatum",
    "Edwards",
    "Giannis",
    "Embiid",
    "Durant",
    "Curry",
]


def fetch_enhanced_data(
    seasons: list[str], min_games: int = 20
) -> pd.DataFrame:
    """Fetch enhanced projection data from NBA API."""
    from core.services.player_stats_service import PlayerStatsService

    service = PlayerStatsService()
    data = service.get_enhanced_projection_data(
        seasons=seasons, min_games=min_games
    )
    logger.info(f"Fetched {len(data)} player-seasons across {len(seasons)} seasons")
    return data


def temporal_split(
    data: pd.DataFrame,
    train_seasons: list[str],
    test_target_season: str,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split data temporally for backtesting.

    Training set: predict seasons in train_seasons (using their N-1, N-2 data).
    Test set: predict test_target_season (using its N-1, N-2 data).

    Since features are built from prior seasons, we need the prior season data
    available in the full dataset. The feature builder handles the pairing.
    """
    # All data needed for training (includes the seasons we predict AND their priors)
    train_data = data[data["SEASON"].isin(train_seasons)].copy()
    # Full data including test season (for building test features)
    all_data = data.copy()

    return train_data, all_data


def build_temporal_test_set(
    all_data: pd.DataFrame,
    test_target_season: str,
    feature_builder: ProjectionFeatureBuilder,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Build test features and targets using temporal holdout.

    Returns (X_test, y_test, info_df) where info_df has player_id, PLAYER_NAME.
    """
    # For the test set, we need:
    # - target = stats from test_target_season
    # - features = prior season(s) data
    seasons_sorted = sorted(all_data["SEASON"].unique())
    test_idx = list(seasons_sorted).index(test_target_season) if test_target_season in seasons_sorted else -1

    if test_idx < 1:
        raise ValueError(f"Cannot build test set: {test_target_season} needs at least one prior season")

    prior_season = seasons_sorted[test_idx - 1]
    two_prior_season = seasons_sorted[test_idx - 2] if test_idx >= 2 else None

    test_actual = all_data[all_data["SEASON"] == test_target_season].copy()
    current_season_df = all_data[all_data["SEASON"] == prior_season].copy()
    prior_season_df = (
        all_data[all_data["SEASON"] == two_prior_season].copy()
        if two_prior_season
        else None
    )

    # Build features for prediction
    X_test = feature_builder.build_inference_features(
        current_season_stats=current_season_df,
        prior_season_stats=prior_season_df,
    )

    # Match predictions to actual test season stats
    # Only include players who appear in both feature set and test actuals
    test_player_ids = set(test_actual["PLAYER_ID"].unique())
    feature_player_ids = set(X_test["player_id"].unique())
    common_ids = test_player_ids & feature_player_ids

    X_test = X_test[X_test["player_id"].isin(common_ids)].copy()
    test_actual = test_actual[test_actual["PLAYER_ID"].isin(common_ids)].copy()

    # Align order
    X_test = X_test.sort_values("player_id").reset_index(drop=True)
    test_actual = test_actual.sort_values("PLAYER_ID").reset_index(drop=True)

    y_test = test_actual[STAT_TARGETS].copy()
    info_df = test_actual[["PLAYER_ID", "PLAYER_NAME"]].copy()

    return X_test, y_test, info_df


def evaluate_backtest(
    projector: XGBoostProjector,
    X_test: pd.DataFrame,
    y_test: pd.DataFrame,
    info_df: pd.DataFrame,
) -> dict[str, dict[str, float]]:
    """Evaluate model on temporal holdout and print detailed report."""
    predictions = projector.predict(X_test)
    pred_df = pd.DataFrame(predictions)

    metrics: dict[str, dict[str, float]] = {}

    print("\n" + "=" * 80)
    print("BACKTEST RESULTS — Holdout Season: 2024-25")
    print("=" * 80)

    print(f"\n{'Stat':<10} {'MAE':>8} {'RMSE':>8} {'R²':>8}")
    print("-" * 38)

    for stat in STAT_TARGETS:
        actual = y_test[stat].values
        predicted = pred_df[stat].values

        mae = mean_absolute_error(actual, predicted)
        rmse = float(np.sqrt(mean_squared_error(actual, predicted)))
        r2 = r2_score(actual, predicted)

        metrics[stat] = {"mae": mae, "rmse": rmse, "r2": r2}
        print(f"{stat:<10} {mae:>8.3f} {rmse:>8.3f} {r2:>8.3f}")

    avg_mae = float(np.mean([m["mae"] for m in metrics.values()]))
    avg_r2 = float(np.mean([m["r2"] for m in metrics.values()]))
    print("-" * 38)
    print(f"{'Average':<10} {avg_mae:>8.3f} {'':>8} {avg_r2:>8.3f}")

    # Top 5 worst misses per stat
    print("\n" + "=" * 80)
    print("TOP 5 WORST MISSES PER STAT")
    print("=" * 80)

    for stat in STAT_TARGETS:
        actual = y_test[stat].values
        predicted = pred_df[stat].values
        errors = np.abs(actual - predicted)
        worst_idx = np.argsort(errors)[::-1][:5]

        print(f"\n{stat}:")
        for idx in worst_idx:
            name = info_df.iloc[idx]["PLAYER_NAME"]
            print(
                f"  {name:<25} Pred: {predicted[idx]:>6.2f}  "
                f"Actual: {actual[idx]:>6.2f}  "
                f"Error: {errors[idx]:>6.2f}"
            )

    # Spot checks on known stars
    print("\n" + "=" * 80)
    print("SPOT CHECKS — KEY PLAYERS")
    print("=" * 80)

    for name_substr in SPOT_CHECK_PLAYERS:
        mask = info_df["PLAYER_NAME"].str.contains(name_substr, case=False, na=False)
        if not mask.any():
            print(f"\n{name_substr}: NOT FOUND in test set")
            continue

        idx = mask.idxmax()
        name = info_df.iloc[idx]["PLAYER_NAME"]
        print(f"\n{name}:")
        print(f"  {'Stat':<10} {'Predicted':>10} {'Actual':>10} {'Error':>10}")
        for stat in STAT_TARGETS:
            pred_val = pred_df.iloc[idx][stat]
            actual_val = y_test.iloc[idx][stat]
            err = abs(pred_val - actual_val)
            print(f"  {stat:<10} {pred_val:>10.2f} {actual_val:>10.2f} {err:>10.2f}")

    # Feature importance
    print("\n" + "=" * 80)
    print("TOP 10 FEATURE IMPORTANCES (averaged across stats)")
    print("=" * 80)

    importance = projector.get_feature_importance()
    avg_importance: dict[str, float] = {}
    for stat_imp in importance.values():
        for feat, imp in stat_imp.items():
            avg_importance[feat] = avg_importance.get(feat, 0.0) + imp / len(importance)

    sorted_importance = sorted(avg_importance.items(), key=lambda x: -x[1])
    for feat, imp in sorted_importance[:10]:
        print(f"  {feat:<35} {imp:.4f}")

    return metrics


def run_optuna_tuning(
    train_data: pd.DataFrame,
    n_trials: int = 50,
) -> dict[str, object]:
    """Run Optuna hyperparameter search."""
    try:
        import optuna
    except ImportError:
        logger.error("Optuna not installed. Run: uv add optuna")
        sys.exit(1)

    feature_builder = ProjectionFeatureBuilder()
    X, y = feature_builder.build_training_data(train_data)

    if X.empty:
        logger.error("No training data generated")
        sys.exit(1)

    X_matrix = feature_builder.get_feature_matrix(X)

    # Use temporal split within training data for validation
    # Last 20% of examples (sorted by target_season) for validation
    n_val = int(len(X_matrix) * 0.2)
    X_sorted = X.sort_values("target_season")
    sorted_indices = X_sorted.index.tolist()
    val_idx = sorted_indices[-n_val:]
    train_idx = sorted_indices[:-n_val]

    X_train = X_matrix[train_idx]
    X_val = X_matrix[val_idx]

    def objective(trial: "optuna.Trial") -> float:
        import xgboost as xgb

        params = {
            "n_estimators": trial.suggest_int("n_estimators", 50, 300),
            "max_depth": trial.suggest_int("max_depth", 3, 6),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "min_child_weight": trial.suggest_int("min_child_weight", 2, 10),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 0.0, 1.0),
            "reg_lambda": trial.suggest_float("reg_lambda", 0.5, 3.0),
            "random_state": 42,
            "n_jobs": -1,
        }

        total_mae = 0.0
        for stat in STAT_TARGETS:
            y_train = y.iloc[train_idx][stat].to_numpy()
            y_val_stat = y.iloc[val_idx][stat].to_numpy()

            model = xgb.XGBRegressor(**params)
            model.fit(X_train, y_train, eval_set=[(X_val, y_val_stat)], verbose=False)
            preds = model.predict(X_val)
            total_mae += mean_absolute_error(y_val_stat, preds)

        return total_mae / len(STAT_TARGETS)

    study = optuna.create_study(direction="minimize")
    study.optimize(objective, n_trials=n_trials)

    print("\n" + "=" * 80)
    print("OPTUNA TUNING RESULTS")
    print("=" * 80)
    print(f"Best average MAE: {study.best_value:.4f}")
    print(f"Best params: {json.dumps(study.best_params, indent=2)}")

    return dict(study.best_params)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train enhanced projection model")
    parser.add_argument(
        "--backtest",
        action="store_true",
        help="Run temporal holdout backtesting after training",
    )
    parser.add_argument(
        "--tune",
        action="store_true",
        help="Run Optuna hyperparameter search",
    )
    parser.add_argument(
        "--trials",
        type=int,
        default=50,
        help="Number of Optuna trials (default: 50)",
    )
    parser.add_argument(
        "--min-games",
        type=int,
        default=20,
        help="Minimum games played filter (default: 20)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(MODEL_DIR),
        help=f"Output directory for saved model (default: {MODEL_DIR})",
    )
    args = parser.parse_args()

    # Fetch data
    logger.info("Fetching enhanced projection data...")
    all_data = fetch_enhanced_data(ALL_SEASONS, min_games=args.min_games)

    if all_data.empty:
        logger.error("No data fetched — check NBA API connectivity and cache")
        sys.exit(1)

    logger.info(f"Total player-seasons: {len(all_data)}")
    logger.info(f"Seasons: {sorted(all_data['SEASON'].unique())}")
    logger.info(f"Columns: {len(all_data.columns)}")

    # Optuna tuning
    model_params = ENHANCED_PARAMS.copy()
    if args.tune:
        train_data, _ = temporal_split(all_data, TRAIN_SEASONS, TEST_TARGET_SEASON)
        best_params = run_optuna_tuning(train_data, n_trials=args.trials)
        model_params.update(best_params)
        model_params["random_state"] = 42
        model_params["n_jobs"] = -1

    # Build features
    feature_builder = ProjectionFeatureBuilder()

    if args.backtest:
        # Temporal split: train on TRAIN_SEASONS, test on TEST_TARGET_SEASON
        train_data, full_data = temporal_split(all_data, TRAIN_SEASONS, TEST_TARGET_SEASON)

        logger.info("Building training features (temporal split)...")
        X_train, y_train = feature_builder.build_training_data(train_data)

        logger.info(
            f"Training set: {len(X_train)} examples, {len(feature_builder.feature_columns)} features"
        )

        # Train model
        projector = XGBoostProjector(model_params=model_params, use_mlflow=False)
        projector.feature_builder = feature_builder
        metrics = projector.train(X_train, y_train, validation_split=0.15)

        # Build test set
        logger.info("Building test features (holdout)...")
        X_test, y_test, info_df = build_temporal_test_set(
            full_data, TEST_TARGET_SEASON, feature_builder
        )
        logger.info(f"Test set: {len(X_test)} players")

        # Evaluate
        backtest_metrics = evaluate_backtest(projector, X_test, y_test, info_df)

        # Save model
        projector.save_model(args.output)
        logger.info(f"Model saved to {args.output}")

    else:
        # Train on ALL data (no holdout) for production model
        logger.info("Building training features (full dataset)...")
        X, y = feature_builder.build_training_data(all_data)

        logger.info(
            f"Full training set: {len(X)} examples, {len(feature_builder.feature_columns)} features"
        )

        # Train model
        projector = XGBoostProjector(model_params=model_params, use_mlflow=False)
        projector.feature_builder = feature_builder
        metrics = projector.train(X, y, validation_split=0.15)

        # Save model
        projector.save_model(args.output)
        logger.info(f"Model saved to {args.output}")

    print("\nDone.")


if __name__ == "__main__":
    main()
