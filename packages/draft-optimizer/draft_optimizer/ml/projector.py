"""XGBoost-based player projection model.

Trains 9 separate XGBoost regressors (one per fantasy stat category)
to predict next-season performance based on historical stats.
"""

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, r2_score

from draft_optimizer.ml.features import STAT_TARGETS, ProjectionFeatureBuilder

logger = logging.getLogger(__name__)

# Try to import MLflow for experiment tracking (optional)
try:
    import mlflow

    MLFLOW_AVAILABLE = True
except ImportError:
    MLFLOW_AVAILABLE = False
    logger.info("MLflow not available - experiment tracking disabled")


class XGBoostProjector:
    """XGBoost-based player projection model.

    Trains separate models for each of the 9 fantasy stat categories:
    - PPG, RPG, APG, SPG, BPG, TOPG, FG%, FT%, 3PM

    Each model uses features from prior seasons to predict next-season stats.
    """

    def __init__(
        self,
        model_params: dict[str, Any] | None = None,
        use_mlflow: bool = True,
    ) -> None:
        """Initialize the projector.

        Args:
            model_params: XGBoost hyperparameters (uses defaults if not provided)
            use_mlflow: Whether to log experiments to MLflow
        """
        self.feature_builder = ProjectionFeatureBuilder()
        self.models: dict[str, xgb.XGBRegressor] = {}
        self.is_trained = False

        # Default model parameters (tuned for small datasets)
        self.model_params = model_params or {
            "n_estimators": 100,
            "max_depth": 4,
            "learning_rate": 0.1,
            "min_child_weight": 3,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "random_state": 42,
            "n_jobs": -1,
        }

        self.use_mlflow = use_mlflow and MLFLOW_AVAILABLE

    def train(
        self,
        X: pd.DataFrame,
        y: pd.DataFrame,
        validation_split: float = 0.2,
        experiment_name: str = "player-projections",
    ) -> dict[str, dict[str, float]]:
        """Train 9 separate XGBoost regressors (one per stat).

        Args:
            X: Feature DataFrame from ProjectionFeatureBuilder
            y: Target DataFrame with columns for each stat
            validation_split: Fraction of data to use for validation
            experiment_name: MLflow experiment name

        Returns:
            Dictionary of metrics per stat: {stat: {mae: float, r2: float}}
        """
        if X.empty or y.empty:
            raise ValueError("Cannot train with empty data")

        # Get feature matrix
        X_matrix = self.feature_builder.get_feature_matrix(X)

        # Split data
        n_samples = len(X_matrix)
        n_val = int(n_samples * validation_split)
        indices = np.random.RandomState(42).permutation(n_samples)

        train_idx = indices[n_val:]
        val_idx = indices[:n_val]

        X_train = X_matrix[train_idx]
        X_val = X_matrix[val_idx]

        # Start MLflow run
        if self.use_mlflow:
            mlflow.set_experiment(experiment_name)
            mlflow.start_run()
            mlflow.log_params(self.model_params)
            mlflow.log_param("n_training_samples", len(train_idx))
            mlflow.log_param("n_validation_samples", len(val_idx))

        metrics: dict[str, dict[str, float]] = {}

        # Train a model for each stat
        for stat in STAT_TARGETS:
            logger.info(f"Training model for {stat}...")

            y_train = y.iloc[train_idx][stat].to_numpy()
            y_val = y.iloc[val_idx][stat].to_numpy()

            # Create and train model
            model = xgb.XGBRegressor(**self.model_params)
            model.fit(
                X_train,
                y_train,
                eval_set=[(X_val, y_val)],
                verbose=False,
            )

            # Evaluate
            y_pred_train = model.predict(X_train)
            y_pred_val = model.predict(X_val)

            train_mae = mean_absolute_error(y_train, y_pred_train)
            val_mae = mean_absolute_error(y_val, y_pred_val)
            val_r2 = r2_score(y_val, y_pred_val)

            metrics[stat] = {
                "train_mae": float(train_mae),
                "val_mae": float(val_mae),
                "val_r2": float(val_r2),
            }

            logger.info(
                f"  {stat}: Train MAE={train_mae:.3f}, Val MAE={val_mae:.3f}, R²={val_r2:.3f}"
            )

            # Log to MLflow
            if self.use_mlflow:
                mlflow.log_metric(f"{stat}_train_mae", train_mae)
                mlflow.log_metric(f"{stat}_val_mae", val_mae)
                mlflow.log_metric(f"{stat}_val_r2", val_r2)

            self.models[stat] = model

        # End MLflow run
        if self.use_mlflow:
            # Log overall metrics
            avg_mae = float(np.mean([m["val_mae"] for m in metrics.values()]))
            avg_r2 = float(np.mean([m["val_r2"] for m in metrics.values()]))
            mlflow.log_metric("avg_val_mae", avg_mae)
            mlflow.log_metric("avg_val_r2", avg_r2)
            mlflow.end_run()

        self.is_trained = True
        logger.info(f"Training complete. Avg Val MAE: {avg_mae:.3f}, Avg R²: {avg_r2:.3f}")

        return metrics

    def predict(self, player_features: pd.DataFrame) -> list[dict[str, float]]:
        """Predict next season stats for players.

        Args:
            player_features: DataFrame from build_inference_features()

        Returns:
            List of dicts with predicted stats for each player
        """
        if not self.is_trained:
            raise RuntimeError("Model must be trained before prediction")

        X_matrix = self.feature_builder.get_feature_matrix(player_features)

        predictions: list[dict[str, float]] = []

        for i in range(len(player_features)):
            player_preds: dict[str, float] = {}
            x = X_matrix[i : i + 1]  # Single sample

            for stat in STAT_TARGETS:
                pred = float(self.models[stat].predict(x)[0])
                # Clamp to reasonable ranges
                pred = max(0.0, min(1.0, pred)) if stat.endswith("_pct") else max(0.0, pred)
                player_preds[stat] = round(pred, 3)

            predictions.append(player_preds)

        return predictions

    def predict_single(self, features: dict[str, float]) -> dict[str, float]:
        """Predict stats for a single player.

        Args:
            features: Dictionary of feature values

        Returns:
            Dictionary of predicted stats
        """
        df = pd.DataFrame([features])
        return self.predict(df)[0]

    def save_model(self, path: str) -> None:
        """Save trained models to disk.

        Args:
            path: Directory path to save models
        """
        if not self.is_trained:
            raise RuntimeError("No trained models to save")

        save_dir = Path(path)
        save_dir.mkdir(parents=True, exist_ok=True)

        # Save each stat model
        for stat, model in self.models.items():
            model_path = save_dir / f"{stat}_model.json"
            model.save_model(str(model_path))

        # Save feature columns
        config = {
            "feature_columns": self.feature_builder.feature_columns,
            "model_params": self.model_params,
            "stats": list(self.models.keys()),
        }
        config_path = save_dir / "config.json"
        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)

        logger.info(f"Saved models to {path}")

    def load_model(self, path: str) -> None:
        """Load trained models from disk.

        Args:
            path: Directory path containing saved models
        """
        load_dir = Path(path)

        if not load_dir.exists():
            raise FileNotFoundError(f"Model directory not found: {path}")

        # Load config
        config_path = load_dir / "config.json"
        with open(config_path) as f:
            config = json.load(f)

        self.feature_builder.feature_columns = config["feature_columns"]
        self.model_params = config["model_params"]

        # Load each stat model
        for stat in config["stats"]:
            model_path = load_dir / f"{stat}_model.json"
            model = xgb.XGBRegressor()
            model.load_model(str(model_path))
            self.models[stat] = model

        self.is_trained = True
        logger.info(f"Loaded models from {path}")

    def get_feature_importance(self) -> dict[str, dict[str, float]]:
        """Get feature importance for each stat model.

        Returns:
            Dictionary mapping stat -> feature -> importance
        """
        if not self.is_trained:
            raise RuntimeError("Model must be trained first")

        importance: dict[str, dict[str, float]] = {}

        for stat, model in self.models.items():
            # Get importance scores
            scores = model.feature_importances_

            # Map to feature names
            feature_importance = {
                self.feature_builder.feature_columns[i]: float(scores[i])
                for i in range(len(scores))
            }

            # Sort by importance
            importance[stat] = dict(
                sorted(feature_importance.items(), key=lambda x: -x[1])
            )

        return importance


def train_projection_model(
    player_seasons: pd.DataFrame,
    save_path: str | None = None,
    experiment_name: str = "player-projections",
) -> tuple[XGBoostProjector, dict[str, dict[str, float]]]:
    """Convenience function to train a projection model.

    Args:
        player_seasons: DataFrame with player-season statistics
        save_path: Optional path to save the trained model
        experiment_name: MLflow experiment name

    Returns:
        Tuple of (trained projector, training metrics)
    """
    # Build features
    builder = ProjectionFeatureBuilder()
    X, y = builder.build_training_data(player_seasons)

    if X.empty:
        raise ValueError("Not enough data to train model")

    # Train model
    projector = XGBoostProjector()
    metrics = projector.train(X, y, experiment_name=experiment_name)

    # Save if requested
    if save_path:
        projector.save_model(save_path)

    return projector, metrics
