# Sports Intelligence Hub — Product Requirements Document

**Version:** 2.0
**Last Updated:** 2026-02-02
**Status:** POC Planning
**Target:** Recruiter Demo (ML + Full-Stack)

---

## Executive Summary

The Sports Intelligence Hub is a **production-grade ML platform** demonstrating end-to-end machine learning engineering through two core modules: a Fantasy Draft Optimizer and a Game Winner Predictor. The key differentiator is **LLM-powered scouting reports** that translate raw model outputs into human-readable analysis via streaming Gemini responses.

This project showcases:
- Feature engineering and predictive modeling (XGBoost)
- Mathematical optimization (Linear Programming)
- Explainable AI (SHAP with dual technical/plain-English modes)
- LLM integration with streaming responses
- Modern MLOps practices (Docker, MLflow, CI/CD)
- Full-stack development (FastAPI + React + PostgreSQL)

**Target Audience:** ML/Data Science and Full-Stack recruiters evaluating end-to-end project capability.

---

## Scope Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Sport** | NBA only (MVP) | Faster iteration, NFL added later |
| **Fantasy Format** | Yahoo/ESPN Standard (9-cat) | Most common format, clear roster rules |
| **Prediction Target** | Game winner | Simpler than player-level clutch, clear evaluation |
| **Differentiator** | LLM scouting reports | Leverages existing RAG/LLM experience, unique angle |
| **Training Data** | Last 3 seasons (~3,600 games) | Recent enough to reflect current NBA style |
| **Cost Constraint** | Free tier only | Gemini free tier, Vercel free, local Docker |
| **Timeline** | 3+ months | Learning-focused, no rush |

---

<Directory_Structure>

```
sports-intelligence-hub/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, test, type-check
│       ├── ml-pipeline.yml           # Model training triggers
│       └── deploy.yml                # Container builds & deployment
│
├── packages/
│   ├── core/                         # Shared utilities & schemas
│   │   ├── src/
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── player.py         # Player data schema
│   │   │   │   ├── game.py           # Game data schema
│   │   │   │   ├── prediction.py     # ML output schemas
│   │   │   │   └── report.py         # Scouting report schema
│   │   │   ├── utils/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── data_loader.py
│   │   │   │   └── validators.py
│   │   │   ├── db/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py         # SQLAlchemy models
│   │   │   │   └── connection.py     # PostgreSQL connection
│   │   │   └── __init__.py
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── README.md
│   │
│   ├── draft-optimizer/              # Module 1: Fantasy Draft
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── __init__.py
│   │   │   │   └── player_features.py  # Feature engineering for projections
│   │   │   ├── models/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── projection_model.py # XGBoost player projections
│   │   │   │   ├── auction_lp.py       # PuLP optimization model
│   │   │   │   └── constraints.py      # Budget, roster rules
│   │   │   ├── services/
│   │   │   │   ├── __init__.py
│   │   │   │   └── optimizer.py        # Main optimization service
│   │   │   └── __init__.py
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── README.md
│   │
│   ├── game-predictor/               # Module 2: Game Winner Prediction
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── team_features.py    # Team-level features
│   │   │   │   ├── matchup_features.py # Head-to-head features
│   │   │   │   └── context_features.py # Rest days, home/away, etc.
│   │   │   ├── models/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── xgboost_model.py    # Core predictor
│   │   │   │   └── explainer.py        # SHAP integration
│   │   │   ├── training/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── pipeline.py         # Scikit-learn pipeline
│   │   │   │   └── hyperopt.py         # Optuna tuning
│   │   │   └── __init__.py
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── README.md
│   │
│   ├── scouting-reports/             # Module 3: LLM Report Generation
│   │   ├── src/
│   │   │   ├── prompts/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── game_preview.py     # Pre-game analysis prompt
│   │   │   │   └── draft_analysis.py   # Draft recommendation prompt
│   │   │   ├── services/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── gemini_client.py    # Gemini API with streaming
│   │   │   │   └── report_generator.py # Orchestrates report creation
│   │   │   └── __init__.py
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── README.md
│   │
│   └── api/                          # FastAPI Backend
│       ├── src/
│       │   ├── routers/
│       │   │   ├── __init__.py
│       │   │   ├── draft.py            # /api/v1/draft/*
│       │   │   ├── predictions.py      # /api/v1/predictions/*
│       │   │   ├── reports.py          # /api/v1/reports/* (streaming)
│       │   │   ├── auth.py             # /api/v1/auth/* (OAuth)
│       │   │   └── health.py           # /api/v1/health
│       │   ├── middleware/
│       │   │   ├── __init__.py
│       │   │   └── logging.py
│       │   ├── auth/
│       │   │   ├── __init__.py
│       │   │   ├── oauth.py            # Google/GitHub OAuth
│       │   │   └── jwt.py              # Token handling
│       │   ├── main.py                 # FastAPI app factory
│       │   └── __init__.py
│       ├── tests/
│       ├── pyproject.toml
│       └── README.md
│
├── apps/
│   └── web/                          # React Frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── DraftOptimizer/
│       │   │   │   ├── PlayerTable.tsx
│       │   │   │   ├── BudgetSlider.tsx
│       │   │   │   ├── RosterBuilder.tsx
│       │   │   │   └── OptimalLineup.tsx
│       │   │   ├── GamePredictor/
│       │   │   │   ├── MatchupCard.tsx
│       │   │   │   ├── PredictionDisplay.tsx
│       │   │   │   ├── ShapWaterfall.tsx
│       │   │   │   └── ShapSimple.tsx     # Human-readable mode
│       │   │   ├── ScoutingReport/
│       │   │   │   ├── ReportViewer.tsx
│       │   │   │   └── StreamingText.tsx  # Typewriter effect
│       │   │   ├── Admin/
│       │   │   │   ├── ModelMetrics.tsx
│       │   │   │   ├── PipelineHealth.tsx
│       │   │   │   └── DataFreshness.tsx
│       │   │   └── shared/
│       │   │       ├── Navbar.tsx
│       │   │       ├── AuthButton.tsx
│       │   │       └── Dashboard.tsx
│       │   ├── hooks/
│       │   │   ├── useAuth.ts
│       │   │   ├── useStreamingReport.ts
│       │   │   └── usePrediction.ts
│       │   ├── lib/
│       │   │   ├── api.ts
│       │   │   └── auth.ts
│       │   └── App.tsx
│       ├── package.json
│       ├── tailwind.config.js
│       ├── vite.config.ts
│       └── README.md
│
├── infrastructure/
│   ├── docker/
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.ml
│   │   └── docker-compose.yml        # Local dev with PostgreSQL
│   ├── aws/                          # Learning AWS deployment
│   │   ├── ecs-task-definition.json
│   │   └── README.md
│   └── scripts/
│       └── setup-local.sh
│
├── mlflow/                           # Model registry & experiments
│   ├── mlruns/
│   └── mlflow.db
│
├── data/
│   ├── raw/                          # Immutable source data
│   │   └── nba/
│   ├── processed/                    # Feature-engineered data
│   │   └── nba/
│   └── cache/                        # API response cache
│
├── notebooks/                        # Exploration & prototyping
│   ├── 01_nba_data_exploration.ipynb
│   ├── 02_feature_engineering.ipynb
│   ├── 03_projection_model.ipynb
│   ├── 04_game_prediction_model.ipynb
│   └── 05_shap_explainability.ipynb
│
├── scripts/
│   ├── fetch_nba_data.py
│   ├── train_projection_model.py
│   ├── train_game_predictor.py
│   └── backtest_optimizer.py
│
├── pyproject.toml                    # Root workspace config (uv)
├── uv.lock                           # Dependency lock file
├── .pre-commit-config.yaml           # Code quality hooks
├── .env.example
├── Makefile                          # Common dev commands
└── README.md
```

**Key Design Decisions:**
- **`packages/`**: Python ML modules as isolated, testable units
- **`packages/scouting-reports/`**: New module for LLM integration
- **`apps/web/`**: React frontend with streaming support
- **PostgreSQL**: Production-grade database for all persisted data
- **OAuth**: Google/GitHub authentication built-in
- **Admin components**: Model monitoring dashboard
- **Monorepo tooling**: `uv` for Python workspaces

</Directory_Structure>

---

<Data_Strategy>

## Data Sources

| Data Type | Library | Source | Update Frequency |
|-----------|---------|--------|------------------|
| **Player Stats** | `nba_api` | stats.nba.com | Daily during season |
| **Game Results** | `nba_api` | stats.nba.com | After each game |
| **Team Stats** | `nba_api` | stats.nba.com | Daily during season |
| **Schedules** | `nba_api` | stats.nba.com | Start of season |

### Python Libraries

```python
# Core data acquisition
nba_api>=1.4.1              # Official NBA stats API wrapper

# Data processing
pandas>=2.2.0
polars>=0.20.0              # High-performance for large datasets
pyarrow>=15.0.0             # Parquet I/O

# Database
sqlalchemy>=2.0.0           # ORM
asyncpg>=0.29.0             # Async PostgreSQL driver
alembic>=1.13.0             # Database migrations

# Validation
pydantic>=2.6.0             # Schema enforcement
pandera>=0.18.0             # DataFrame validation

# Caching (for API rate limits)
diskcache>=5.6.0            # Local file-based cache
```

## Database Schema (PostgreSQL)

```sql
-- Core tables
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    nba_player_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    team VARCHAR(50),
    position VARCHAR(10),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    nba_game_id VARCHAR(20) UNIQUE NOT NULL,
    season VARCHAR(10) NOT NULL,           -- "2024-25"
    game_date DATE NOT NULL,
    home_team VARCHAR(50) NOT NULL,
    away_team VARCHAR(50) NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    winner VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE player_game_stats (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    game_id INTEGER REFERENCES games(id),
    minutes FLOAT,
    points INTEGER,
    rebounds INTEGER,
    assists INTEGER,
    steals INTEGER,
    blocks INTEGER,
    turnovers INTEGER,
    fg_pct FLOAT,
    ft_pct FLOAT,
    three_pct FLOAT,
    fantasy_points FLOAT,                  -- Calculated 9-cat score
    UNIQUE(player_id, game_id)
);

-- Predictions & Reports
CREATE TABLE game_predictions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    model_version VARCHAR(50) NOT NULL,
    predicted_winner VARCHAR(50) NOT NULL,
    win_probability FLOAT NOT NULL,
    shap_values JSONB,                     -- Stored for explainability
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE scouting_reports (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    report_type VARCHAR(20) NOT NULL,      -- "game_preview", "draft_analysis"
    content TEXT NOT NULL,
    model_used VARCHAR(50) NOT NULL,       -- "gemini-1.5-flash"
    created_at TIMESTAMP DEFAULT NOW()
);

-- Auth
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    oauth_provider VARCHAR(20) NOT NULL,   -- "google", "github"
    oauth_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);
```

## Data Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Data Ingestion Layer                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐      ┌──────────────┐      ┌────────────────┐   │
│   │ nba_api  │─────▶│ Rate Limiter │─────▶│ Local Cache    │   │
│   └──────────┘      │ (1 req/sec)  │      │ (diskcache)    │   │
│                     └──────────────┘      └───────┬────────┘   │
│                                                   │             │
│                                                   ▼             │
│                     ┌──────────────────────────────────────┐   │
│                     │         Pandera Validation            │   │
│                     │    (Schema enforcement on DataFrames) │   │
│                     └──────────────────┬───────────────────┘   │
│                                        │                        │
│                                        ▼                        │
│                     ┌──────────────────────────────────────┐   │
│                     │           PostgreSQL                  │   │
│                     │   (players, games, player_game_stats) │   │
│                     └──────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Caching Strategy (Free Tier Friendly)

```python
# packages/core/src/utils/data_loader.py
import diskcache
from nba_api.stats.endpoints import leaguegamefinder
import time

class NBADataLoader:
    def __init__(self, cache_dir: str = "data/cache"):
        self.cache = diskcache.Cache(cache_dir)
        self.rate_limit_delay = 1.0  # 1 second between requests

    def get_games(self, season: str, force_refresh: bool = False) -> pd.DataFrame:
        cache_key = f"games_{season}"

        if not force_refresh and cache_key in self.cache:
            return self.cache[cache_key]

        time.sleep(self.rate_limit_delay)  # Rate limiting

        games = leaguegamefinder.LeagueGameFinder(
            season_nullable=season,
            league_id_nullable="00"
        ).get_data_frames()[0]

        self.cache.set(cache_key, games, expire=86400)  # 24h cache
        return games
```

</Data_Strategy>

---

<ML_Phases>

## Phase 1: Draft Optimizer (ML Projections + LP Selection)

**Objective:** Predict player fantasy points, then use Linear Programming to select the optimal roster within budget constraints.

### Part A: Player Projection Model (XGBoost)

**Target Variable:** `fantasy_points` (9-category Yahoo/ESPN scoring)

```python
# 9-Cat Fantasy Scoring (Yahoo/ESPN Standard)
fantasy_points = (
    points * 1.0 +
    rebounds * 1.2 +
    assists * 1.5 +
    steals * 3.0 +
    blocks * 3.0 +
    turnovers * -1.0 +
    fg_made * 0.5 +    # Adjust for FG%
    ft_made * 0.5 +    # Adjust for FT%
    three_made * 0.5   # 3PT bonus
)
```

### Feature Engineering for Projections

```python
# packages/draft-optimizer/src/features/player_features.py

PROJECTION_FEATURES = {
    "rolling_stats": [
        "avg_fantasy_points_last_5",
        "avg_fantasy_points_last_10",
        "avg_fantasy_points_last_30",
        "std_fantasy_points_last_10",    # Consistency measure
    ],
    "season_averages": [
        "season_ppg",
        "season_rpg",
        "season_apg",
        "season_minutes",
    ],
    "usage_context": [
        "usage_rate",
        "minutes_share",                  # % of team minutes
        "is_starter",
    ],
    "matchup": [
        "opponent_def_rating",            # Defensive efficiency
        "opponent_pace",                  # Tempo affects stats
        "days_rest",
    ],
    "situational": [
        "is_home",
        "is_back_to_back",
        "games_played_season",            # Early season = volatile
    ],
}
```

### Part B: Roster Optimization (PuLP Linear Programming)

```python
# packages/draft-optimizer/src/models/auction_lp.py
from pulp import LpMaximize, LpProblem, LpVariable, lpSum

class AuctionOptimizer:
    """
    Yahoo/ESPN Standard Roster:
    - PG: 1-2 players
    - SG: 1-2 players
    - SF: 1-2 players
    - PF: 1-2 players
    - C: 1-2 players
    - Util: 1-3 players (any position)
    - Total: 10 players
    - Budget: $200
    """

    ROSTER_RULES = {
        "PG": {"min": 1, "max": 3},
        "SG": {"min": 1, "max": 3},
        "SF": {"min": 1, "max": 3},
        "PF": {"min": 1, "max": 3},
        "C": {"min": 1, "max": 3},
    }
    ROSTER_SIZE = 10
    BUDGET = 200

    def __init__(self, players: list[dict]):
        """
        players: List of dicts with keys:
            - id, name, position, projected_points, auction_value
        """
        self.players = players
        self.prob = LpProblem("Fantasy_Auction", LpMaximize)
        self.x = {p["id"]: LpVariable(f"x_{p['id']}", cat="Binary")
                  for p in players}

    def build_model(self) -> None:
        # Objective: maximize total projected fantasy points
        self.prob += lpSum(
            p["projected_points"] * self.x[p["id"]]
            for p in self.players
        ), "Total_Projected_Points"

        # Budget constraint
        self.prob += lpSum(
            p["auction_value"] * self.x[p["id"]]
            for p in self.players
        ) <= self.BUDGET, "Budget_Constraint"

        # Roster size constraint
        self.prob += lpSum(
            self.x[p["id"]] for p in self.players
        ) == self.ROSTER_SIZE, "Roster_Size"

        # Position constraints
        for pos, rules in self.ROSTER_RULES.items():
            pos_players = [p for p in self.players if pos in p["position"]]
            self.prob += lpSum(
                self.x[p["id"]] for p in pos_players
            ) >= rules["min"], f"Min_{pos}"
            self.prob += lpSum(
                self.x[p["id"]] for p in pos_players
            ) <= rules["max"], f"Max_{pos}"

    def solve(self) -> dict:
        self.build_model()
        self.prob.solve()

        selected = [
            p for p in self.players
            if self.x[p["id"]].value() == 1
        ]

        return {
            "status": self.prob.status,
            "total_points": sum(p["projected_points"] for p in selected),
            "total_cost": sum(p["auction_value"] for p in selected),
            "roster": selected,
        }
```

### Evaluation Metrics (Phase 1)

| Metric | Target | What It Measures |
|--------|--------|------------------|
| **Projection MAE** | < 5.0 fantasy pts | How accurate are player projections |
| **Projection RMSE** | < 7.0 fantasy pts | Penalizes large misses |
| **Optimizer Runtime** | < 500ms | Speed for 300+ player pool |
| **Backtest Top-20%** | > 60% of weeks | Optimized lineups beat random drafts |

---

## Phase 2: Game Winner Prediction (XGBoost + SHAP)

**Objective:** Predict which team wins an NBA game and explain the key factors driving the prediction.

### Target Variable

```python
# Binary classification
target = 1 if home_team_wins else 0
```

### Feature Engineering

```python
# packages/game-predictor/src/features/team_features.py

GAME_PREDICTION_FEATURES = {
    "team_strength": [
        "home_team_win_pct_last_10",
        "away_team_win_pct_last_10",
        "home_team_net_rating",           # Off rating - Def rating
        "away_team_net_rating",
        "home_team_elo",                  # Running ELO rating
        "away_team_elo",
    ],
    "recent_form": [
        "home_team_streak",               # Positive = wins, negative = losses
        "away_team_streak",
        "home_team_avg_margin_last_5",
        "away_team_avg_margin_last_5",
    ],
    "matchup_history": [
        "home_team_h2h_wins_season",      # Head-to-head this season
        "home_team_h2h_avg_margin",
    ],
    "rest_and_travel": [
        "home_team_rest_days",
        "away_team_rest_days",
        "away_team_distance_traveled",    # Road trip fatigue
        "home_team_b2b",                  # Back-to-back flag
        "away_team_b2b",
    ],
    "injuries_availability": [
        "home_team_injured_player_impact", # Sum of injured players' win shares
        "away_team_injured_player_impact",
    ],
    "contextual": [
        "is_rivalry_game",                # Lakers-Celtics, etc.
        "month_of_season",                # Early season more volatile
        "home_team_playoff_clinched",     # May rest starters
    ],
}
```

### Model Pipeline

```python
# packages/game-predictor/src/training/pipeline.py
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler
from sklearn.impute import KNNImputer
from xgboost import XGBClassifier

def create_training_pipeline() -> Pipeline:
    return Pipeline([
        ("imputer", KNNImputer(n_neighbors=5)),
        ("scaler", RobustScaler()),
        ("classifier", XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            use_label_encoder=False,
            eval_metric="logloss",
        ))
    ])
```

### SHAP Explainability (Dual Mode)

```python
# packages/game-predictor/src/models/explainer.py
import shap

class GameExplainer:
    def __init__(self, model, X_train):
        self.explainer = shap.TreeExplainer(model)
        self.feature_names = X_train.columns.tolist()

    def explain(self, X_game, mode: str = "technical") -> dict:
        shap_values = self.explainer.shap_values(X_game)

        if mode == "technical":
            return self._technical_explanation(shap_values, X_game)
        else:
            return self._human_readable_explanation(shap_values, X_game)

    def _technical_explanation(self, shap_values, X_game) -> dict:
        """Raw SHAP values for data scientists"""
        return {
            "base_value": float(self.explainer.expected_value),
            "shap_values": dict(zip(self.feature_names, shap_values[0].tolist())),
            "feature_values": dict(zip(self.feature_names, X_game.values[0].tolist())),
        }

    def _human_readable_explanation(self, shap_values, X_game) -> dict:
        """Plain English for general users"""
        # Map features to readable descriptions
        feature_descriptions = {
            "home_team_win_pct_last_10": "recent home team form",
            "away_team_rest_days": "away team rest advantage",
            "home_team_net_rating": "home team overall strength",
            # ... more mappings
        }

        top_factors = self._get_top_factors(shap_values, n=5)

        explanations = []
        for feat, impact in top_factors:
            direction = "helps" if impact > 0 else "hurts"
            readable_name = feature_descriptions.get(feat, feat)
            explanations.append({
                "factor": readable_name,
                "impact": f"{direction} home team",
                "strength": abs(impact),
            })

        return {
            "summary": self._generate_summary(explanations),
            "factors": explanations,
        }
```

### Evaluation Metrics (Phase 2)

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Accuracy** | > 65% | Better than baseline (home team wins ~58%) |
| **AUC-ROC** | > 0.70 | Measures ranking quality |
| **Brier Score** | < 0.22 | Calibration of probabilities |
| **Log Loss** | < 0.60 | Penalizes confident wrong predictions |

---

## Phase 3: LLM Scouting Reports (Gemini Streaming)

**Objective:** Transform raw model outputs into engaging, human-readable scouting reports using Gemini with streaming responses.

### Gemini Integration (Free Tier)

```python
# packages/scouting-reports/src/services/gemini_client.py
import google.generativeai as genai
from typing import AsyncGenerator

class GeminiClient:
    """
    Gemini 1.5 Flash Free Tier Limits (as of 2026):
    - 15 requests per minute
    - 1 million tokens per minute
    - 1,500 requests per day
    """

    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-1.5-flash")

    async def stream_report(
        self,
        prompt: str
    ) -> AsyncGenerator[str, None]:
        """Stream response chunks for real-time UI updates"""
        response = await self.model.generate_content_async(
            prompt,
            stream=True
        )

        async for chunk in response:
            if chunk.text:
                yield chunk.text
```

### Report Generation Prompts

```python
# packages/scouting-reports/src/prompts/game_preview.py

GAME_PREVIEW_PROMPT = """
You are an NBA analyst writing a pre-game scouting report. Based on the data below,
write an engaging 3-4 paragraph analysis that a basketball fan would enjoy reading.

**Game:** {home_team} vs {away_team}
**Date:** {game_date}

**Model Prediction:**
- Predicted Winner: {predicted_winner}
- Win Probability: {win_probability:.1%}

**Key Factors (from SHAP analysis):**
{shap_factors}

**Team Statistics:**
- {home_team}: {home_record}, Net Rating: {home_net_rating:+.1f}
- {away_team}: {away_record}, Net Rating: {away_net_rating:+.1f}

**Recent Form:**
- {home_team} last 5: {home_last_5}
- {away_team} last 5: {away_last_5}

Write the report in an engaging sports journalism style. Include:
1. A hook/opening that captures the matchup narrative
2. Analysis of why the model favors one team (referencing the SHAP factors)
3. Key matchups or storylines to watch
4. A confident but measured prediction

Do NOT use bullet points. Write in flowing paragraphs.
"""
```

### Streaming API Endpoint

```python
# packages/api/src/routers/reports.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/v1/reports")

@router.get("/game/{game_id}/preview")
async def stream_game_preview(game_id: int):
    """Stream scouting report with Server-Sent Events"""

    async def generate():
        # Get prediction and SHAP values
        prediction = await get_prediction(game_id)

        # Build prompt with data
        prompt = build_game_preview_prompt(prediction)

        # Stream from Gemini
        async for chunk in gemini_client.stream_report(prompt):
            yield f"data: {chunk}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )
```

</ML_Phases>

---

<Recruiter_Focus>

## Advanced Features for Technical Differentiation

### 1. SHAP Explainability with Dual Display Modes

**Why it matters:** Shows understanding of Explainable AI (XAI) and UX considerations for different audiences.

**Implementation:**
- Technical mode: Raw SHAP waterfall chart with feature names and values
- Simple mode: Plain English explanations ("The Lakers' recent winning streak gives them an edge")
- Toggle switch in UI to switch between modes

```typescript
// apps/web/src/components/GamePredictor/ShapToggle.tsx
const ShapDisplay = ({ prediction, mode }: Props) => {
  if (mode === "technical") {
    return <ShapWaterfall data={prediction.shap_values} />;
  }
  return <ShapSimple factors={prediction.human_explanations} />;
};
```

---

### 2. LLM-Powered Streaming Scouting Reports

**Why it matters:** Demonstrates modern AI integration, streaming architecture, and product differentiation.

**Key technical aspects:**
- Server-Sent Events (SSE) for real-time streaming
- Gemini API integration with rate limiting
- Prompt engineering for consistent, engaging output
- Caching layer to stay within free tier limits

```typescript
// apps/web/src/hooks/useStreamingReport.ts
export function useStreamingReport(gameId: number) {
  const [report, setReport] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = async () => {
    setIsStreaming(true);
    setReport("");

    const eventSource = new EventSource(
      `/api/v1/reports/game/${gameId}/preview`
    );

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();
        setIsStreaming(false);
      } else {
        setReport(prev => prev + event.data);
      }
    };
  };

  return { report, isStreaming, startStream };
}
```

---

### 3. MLflow Model Registry with Experiment Tracking

**Why it matters:** Production ML maturity—experiment tracking, model versioning, and reproducibility.

```python
# scripts/train_game_predictor.py
import mlflow
from mlflow.tracking import MlflowClient

def train_and_register():
    mlflow.set_experiment("game-winner-prediction")

    with mlflow.start_run():
        # Log parameters
        mlflow.log_params({
            "model_type": "xgboost",
            "n_estimators": 200,
            "max_depth": 6,
            "training_seasons": "2022-2025",
        })

        # Train
        model = train_model(X_train, y_train)

        # Log metrics
        metrics = evaluate_model(model, X_test, y_test)
        mlflow.log_metrics({
            "accuracy": metrics["accuracy"],
            "auc_roc": metrics["auc_roc"],
            "brier_score": metrics["brier_score"],
        })

        # Log model with signature
        signature = mlflow.models.infer_signature(X_test, model.predict(X_test))
        mlflow.xgboost.log_model(
            model,
            "game_predictor",
            signature=signature,
            registered_model_name="NBAGamePredictor"
        )
```

---

### 4. Admin Dashboard for Model Monitoring

**Why it matters:** Shows production thinking—models need monitoring, not just deployment.

**Dashboard components:**
- **Model Metrics:** Accuracy over time, prediction distribution
- **Data Pipeline Health:** Last successful fetch, cache hit rates
- **Data Freshness:** Age of latest player stats, upcoming games loaded

```typescript
// apps/web/src/components/Admin/ModelMetrics.tsx
const ModelMetrics = () => {
  const { data } = useQuery("modelMetrics", fetchModelMetrics);

  return (
    <div className="grid grid-cols-3 gap-4">
      <MetricCard
        title="7-Day Accuracy"
        value={`${data.accuracy_7d}%`}
        trend={data.accuracy_trend}
      />
      <MetricCard
        title="Predictions Today"
        value={data.predictions_today}
      />
      <MetricCard
        title="Model Version"
        value={data.model_version}
      />
    </div>
  );
};
```

---

### 5. Containerized Development with Docker Compose

```yaml
# infrastructure/docker/docker-compose.yml
services:
  api:
    build:
      context: ../..
      dockerfile: infrastructure/docker/Dockerfile.api
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/sports_hub
      - MLFLOW_TRACKING_URI=http://mlflow:5000
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      - db
      - mlflow

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=sports_hub
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  mlflow:
    image: ghcr.io/mlflow/mlflow:v2.10.0
    ports:
      - "5000:5000"
    command: >
      mlflow server
      --host 0.0.0.0
      --backend-store-uri sqlite:///mlflow/mlflow.db
      --default-artifact-root ./mlflow/artifacts
    volumes:
      - ../../mlflow:/mlflow

  web:
    build:
      context: ../../apps/web
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      - api

volumes:
  postgres_data:
```

</Recruiter_Focus>

---

<Testing_Strategy>

## Unit & Integration Testing Approach

Testing will be done at each checkpoint before moving to the next phase.

### Unit Tests (pytest)

```python
# packages/draft-optimizer/tests/test_optimizer.py
import pytest
from src.models.auction_lp import AuctionOptimizer

class TestAuctionOptimizer:
    @pytest.fixture
    def sample_players(self):
        return [
            {"id": "p1", "name": "Player 1", "position": "PG",
             "projected_points": 40.0, "auction_value": 50},
            {"id": "p2", "name": "Player 2", "position": "SG",
             "projected_points": 35.0, "auction_value": 40},
            # ... more players
        ]

    def test_budget_constraint_respected(self, sample_players):
        optimizer = AuctionOptimizer(sample_players)
        result = optimizer.solve()

        assert result["total_cost"] <= 200, "Budget exceeded"

    def test_roster_size_correct(self, sample_players):
        optimizer = AuctionOptimizer(sample_players)
        result = optimizer.solve()

        assert len(result["roster"]) == 10, "Wrong roster size"

    def test_position_minimums_met(self, sample_players):
        optimizer = AuctionOptimizer(sample_players)
        result = optimizer.solve()

        positions = [p["position"] for p in result["roster"]]
        assert positions.count("PG") >= 1, "No PG selected"
        assert positions.count("C") >= 1, "No C selected"
```

### Integration Tests (API Endpoints)

```python
# packages/api/tests/test_predictions.py
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

class TestPredictionsAPI:
    def test_get_prediction_returns_valid_structure(self):
        response = client.get("/api/v1/predictions/game/123")

        assert response.status_code == 200
        data = response.json()
        assert "predicted_winner" in data
        assert "win_probability" in data
        assert 0 <= data["win_probability"] <= 1

    def test_shap_values_included(self):
        response = client.get("/api/v1/predictions/game/123?include_shap=true")

        data = response.json()
        assert "shap_values" in data
        assert isinstance(data["shap_values"], dict)
```

### Model Quality Tests

```python
# packages/game-predictor/tests/test_model_quality.py
import pytest
from sklearn.metrics import accuracy_score, roc_auc_score

class TestModelQuality:
    """Run as part of CI to prevent model regression"""

    ACCURACY_THRESHOLD = 0.63
    AUC_THRESHOLD = 0.68

    def test_accuracy_above_threshold(self, trained_model, test_data):
        X_test, y_test = test_data
        y_pred = trained_model.predict(X_test)

        accuracy = accuracy_score(y_test, y_pred)
        assert accuracy >= self.ACCURACY_THRESHOLD, \
            f"Accuracy {accuracy:.3f} below threshold {self.ACCURACY_THRESHOLD}"

    def test_auc_above_threshold(self, trained_model, test_data):
        X_test, y_test = test_data
        y_proba = trained_model.predict_proba(X_test)[:, 1]

        auc = roc_auc_score(y_test, y_proba)
        assert auc >= self.AUC_THRESHOLD, \
            f"AUC {auc:.3f} below threshold {self.AUC_THRESHOLD}"
```

</Testing_Strategy>

---

<Cost_Analysis>

## Free Tier Usage Plan

| Service | Free Tier Limits | Our Usage | Status |
|---------|------------------|-----------|--------|
| **Gemini 1.5 Flash** | 15 RPM, 1,500 req/day | ~50 reports/day max | ✅ Safe |
| **Vercel** | 100GB bandwidth, serverless | Frontend hosting | ✅ Safe |
| **PostgreSQL (local)** | Unlimited (Docker) | Development | ✅ Free |
| **Supabase (optional)** | 500MB, 2GB transfer | If cloud DB needed | ✅ Safe |
| **GitHub Actions** | 2,000 min/month | CI/CD | ✅ Safe |
| **MLflow** | Self-hosted | Local Docker | ✅ Free |

### Cost Mitigation Strategies

1. **Aggressive Caching:** Cache NBA API responses for 24h, Gemini reports for 12h
2. **Rate Limiting:** Enforce 1 req/sec to NBA API, queue Gemini requests
3. **Local Development:** Docker Compose for PostgreSQL, MLflow—no cloud costs
4. **Lazy Generation:** Only generate scouting reports on user request, not pre-computed

</Cost_Analysis>

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up monorepo structure with uv
- [ ] Implement NBA data fetching with caching
- [ ] Create PostgreSQL schema and models
- [ ] Build basic FastAPI skeleton with health checks
- [ ] Write unit tests for data layer

### Phase 2: Draft Optimizer (Weeks 3-4)
- [ ] Feature engineering for player projections
- [ ] Train XGBoost projection model
- [ ] Implement PuLP optimization solver
- [ ] Build draft optimizer API endpoints
- [ ] Create basic React UI for draft tool
- [ ] Integration tests for optimizer flow

### Phase 3: Game Predictor (Weeks 5-7)
- [ ] Feature engineering for game prediction
- [ ] Train XGBoost classifier with Optuna tuning
- [ ] Implement SHAP explainer (dual mode)
- [ ] MLflow experiment tracking setup
- [ ] Build prediction API endpoints
- [ ] Create React UI with SHAP visualizations
- [ ] Model quality tests in CI

### Phase 4: LLM Integration (Weeks 8-9)
- [ ] Gemini API integration with streaming
- [ ] Prompt engineering for scouting reports
- [ ] SSE streaming endpoint
- [ ] React streaming text component
- [ ] Caching layer for reports

### Phase 5: Auth & Polish (Weeks 10-11)
- [ ] OAuth implementation (Google/GitHub)
- [ ] Admin dashboard components
- [ ] Mobile responsive styling
- [ ] Docker Compose production setup
- [ ] End-to-end testing

### Phase 6: Demo Prep (Week 12+)
- [ ] AWS deployment (learning)
- [ ] Documentation and README
- [ ] Demo script and recording
- [ ] Performance optimization

---

## Success Criteria

- [ ] Draft optimizer returns results in < 500ms for 300 players
- [ ] Game prediction accuracy > 65% on holdout set
- [ ] SHAP explanations render in < 200ms
- [ ] Scouting reports stream with visible typing effect
- [ ] Full Docker-compose deployment in single command
- [ ] All unit and integration tests passing
- [ ] Mobile-responsive UI
- [ ] OAuth login working

---

## Future Enhancements (Post-MVP)

1. **Live Game Tracking:** Real-time score updates and in-game predictions
2. **Social Features:** Share predictions, leaderboards, follow other users
3. **Betting Odds Integration:** Compare model predictions to Vegas lines
4. **NFL Expansion:** Apply same architecture to NFL data
5. **Push Notifications:** Alerts for games, injury updates

---

*This document reflects requirements gathered through stakeholder interview on 2026-02-02. All decisions prioritize learning, recruiter appeal, and zero/minimal cost.*
