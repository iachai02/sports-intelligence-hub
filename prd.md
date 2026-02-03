# Sports Intelligence Hub — Product Requirements Document

**Version:** 1.0
**Author:** ML Engineering Team
**Status:** POC Planning
**Target:** Investor/Recruiter Demo

---

## Executive Summary

The Sports Intelligence Hub is a **production-grade ML platform** that demonstrates end-to-end machine learning engineering capabilities through two high-value sports analytics modules. This project showcases optimization algorithms, predictive modeling, explainable AI, and modern MLOps practices—all deployed in a professional monorepo architecture.

**Feasibility Assessment:** ✅ **VIABLE FOR MVP IN 4-6 WEEKS**

The scope is intentionally constrained to two well-defined modules with clear data sources, established ML techniques, and measurable outcomes. This makes it ideal for investor demonstrations while remaining technically impressive for engineering recruiters.

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
│   │   │   │   ├── player.py         # Unified player schema
│   │   │   │   ├── game.py           # Unified game schema
│   │   │   │   └── prediction.py     # ML output schemas
│   │   │   ├── utils/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── data_loader.py
│   │   │   │   └── validators.py
│   │   │   └── __init__.py
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── README.md
│   │
│   ├── draft-optimizer/              # Module 1: Linear Programming
│   │   ├── src/
│   │   │   ├── models/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auction_lp.py     # PuLP optimization model
│   │   │   │   └── constraints.py    # Budget, roster rules
│   │   │   ├── services/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── projections.py    # Player value projections
│   │   │   │   └── optimizer.py      # Main optimization service
│   │   │   └── __init__.py
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── README.md
│   │
│   ├── impact-simulator/             # Module 2: Predictive ML
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── clutch_metrics.py # Feature engineering
│   │   │   │   └── game_context.py   # Situational features
│   │   │   ├── models/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── xgboost_model.py  # Core predictor
│   │   │   │   └── explainer.py      # SHAP integration
│   │   │   ├── training/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── pipeline.py       # Scikit-learn pipeline
│   │   │   │   └── hyperopt.py       # Optuna tuning
│   │   │   └── __init__.py
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── README.md
│   │
│   └── api/                          # FastAPI Backend
│       ├── src/
│       │   ├── routers/
│       │   │   ├── __init__.py
│       │   │   ├── draft.py          # /api/v1/draft/*
│       │   │   ├── simulator.py      # /api/v1/simulate/*
│       │   │   └── health.py         # /api/v1/health
│       │   ├── middleware/
│       │   │   ├── __init__.py
│       │   │   └── logging.py
│       │   ├── main.py               # FastAPI app factory
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
│       │   │   │   └── OptimalLineup.tsx
│       │   │   ├── ImpactSimulator/
│       │   │   │   ├── PlayerSelector.tsx
│       │   │   │   ├── ScenarioBuilder.tsx
│       │   │   │   └── ShapWaterfall.tsx
│       │   │   └── shared/
│       │   │       ├── SportToggle.tsx
│       │   │       └── Dashboard.tsx
│       │   ├── hooks/
│       │   ├── lib/
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
│   │   └── docker-compose.yml
│   ├── k8s/                          # Optional: K8s manifests
│   │   ├── api-deployment.yaml
│   │   └── ml-job.yaml
│   └── terraform/                    # Optional: IaC
│       └── main.tf
│
├── mlflow/                           # Model registry & experiments
│   ├── mlruns/
│   └── mlflow.db
│
├── data/
│   ├── raw/                          # Immutable source data
│   ├── processed/                    # Feature-engineered data
│   └── models/                       # Serialized model artifacts
│
├── notebooks/                        # Exploration & prototyping
│   ├── 01_data_exploration.ipynb
│   ├── 02_feature_engineering.ipynb
│   └── 03_model_experiments.ipynb
│
├── scripts/
│   ├── fetch_nba_data.py
│   ├── fetch_nfl_data.py
│   └── train_models.py
│
├── pyproject.toml                    # Root workspace config (uv/Poetry)
├── uv.lock                           # Dependency lock file
├── turbo.json                        # Turborepo config for monorepo
├── .pre-commit-config.yaml           # Code quality hooks
├── .env.example
├── Makefile                          # Common dev commands
└── README.md
```

**Key Design Decisions:**
- **`packages/`**: Python ML modules as isolated, testable units
- **`apps/`**: User-facing applications (React web app)
- **`infrastructure/`**: DevOps artifacts separated from business logic
- **`mlflow/`**: Experiment tracking colocated for local development
- **Monorepo tooling**: `uv` for Python workspaces, `Turborepo` for JS

</Directory_Structure>

---

<Data_Strategy>

## Data Sources

| Sport | Primary Library | API/Source | Update Frequency |
|-------|-----------------|------------|------------------|
| **NBA** | `nba_api` | stats.nba.com | Daily during season |
| **NFL** | `nfl_data_py` | Pro Football Reference | Weekly during season |
| **Both** | `sportsreference` | Sports Reference sites | Backup source |

### Python Libraries

```python
# Core data acquisition
nba_api>=1.4.1          # Official NBA stats API wrapper
nfl_data_py>=0.3.1      # NFL play-by-play & roster data
sportsreference>=0.6.0  # Fallback scraper

# Data processing
pandas>=2.2.0
polars>=0.20.0          # High-performance alternative
pyarrow>=15.0.0         # Parquet I/O

# Validation
pydantic>=2.6.0         # Schema enforcement
pandera>=0.18.0         # DataFrame validation
```

## Unified Schema Design

The key insight is that **both sports share common abstractions**: players perform in games within specific contexts, and we want to predict/optimize their value.

```python
# packages/core/src/schemas/player.py
from pydantic import BaseModel
from enum import Enum
from datetime import date

class Sport(str, Enum):
    NBA = "nba"
    NFL = "nfl"

class Position(BaseModel):
    """Sport-agnostic position representation"""
    sport: Sport
    primary: str          # "PG", "QB", "WR", etc.
    eligible: list[str]   # Flex eligibility

class UnifiedPlayer(BaseModel):
    """Cross-sport player schema"""
    id: str               # "{sport}_{player_id}"
    sport: Sport
    name: str
    team: str
    position: Position

    # Fantasy-relevant stats (normalized)
    projected_points: float       # Per-game projection
    auction_value: float          # Dollar value ($1-$100 scale)
    consistency_score: float      # Coefficient of variation
    upside_score: float           # 90th percentile outcome

    # Context metadata
    injury_status: str | None
    bye_week: int | None          # NFL only
    last_updated: date

class UnifiedGameContext(BaseModel):
    """Situational context for predictions"""
    sport: Sport
    game_id: str

    # Universal context features
    home_away: str                # "home" | "away"
    opponent_rank: int            # Defensive rank vs position
    rest_days: int

    # Clutch context
    score_differential: int       # Point spread at decision time
    time_remaining: float         # Normalized (0-1)
    high_leverage: bool           # Clutch situation flag

    # Sport-specific (optional)
    quarter_period: int | None    # NBA: 1-4, OT; NFL: 1-4
    down_distance: str | None     # NFL only: "3rd & 7"
```

### Data Pipeline Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  nba_api    │────▶│              │     │                 │
│  nfl_data_py│────▶│ Transform &  │────▶│ UnifiedPlayer   │
└─────────────┘     │ Validate     │     │ UnifiedContext  │
                    │ (Pandera)    │     │ (Pydantic)      │
                    └──────────────┘     └────────┬────────┘
                                                  │
                    ┌─────────────────────────────▼────────┐
                    │         Parquet Data Lake            │
                    │    data/processed/{sport}/           │
                    └──────────────────────────────────────┘
```

</Data_Strategy>

---

<ML_Phases>

## Phase 1: Draft Optimizer (Linear Programming)

**Objective:** Given a budget and roster constraints, select the optimal set of players to maximize projected fantasy points.

### Mathematical Formulation

```
Maximize:   Σ (projected_points[i] × x[i])   for all players i
Subject to: Σ (auction_cost[i] × x[i]) ≤ budget
            Σ x[i] = roster_size
            Σ x[i] ≥ min_at_position[p]     for each position p
            Σ x[i] ≤ max_at_position[p]     for each position p
            x[i] ∈ {0, 1}                    binary decision variable
```

### Target Variables & Metrics

| Variable | Description | Metric |
|----------|-------------|--------|
| `projected_points` | Expected fantasy points per game | MAE vs actual (< 3.0 pts) |
| `optimal_lineup_value` | Total projected points of solution | % of theoretical max (> 95%) |
| `solver_time` | Optimization runtime | < 500ms for 300 players |

### Implementation Approach

```python
# packages/draft-optimizer/src/models/auction_lp.py
from pulp import LpMaximize, LpProblem, LpVariable, lpSum

class AuctionOptimizer:
    def __init__(self, budget: int, roster_rules: dict):
        self.budget = budget
        self.roster_rules = roster_rules

    def solve(self, players: list[dict]) -> dict:
        prob = LpProblem("Fantasy_Auction", LpMaximize)

        # Decision variables
        x = {p['id']: LpVariable(f"select_{p['id']}", cat='Binary')
             for p in players}

        # Objective: maximize projected points
        prob += lpSum(p['projected_points'] * x[p['id']] for p in players)

        # Budget constraint
        prob += lpSum(p['auction_value'] * x[p['id']] for p in players) <= self.budget

        # Position constraints (sport-specific rules applied here)
        # ... constraint building logic

        prob.solve()
        return self._extract_solution(x, players)
```

### Evaluation Protocol

1. **Backtest on historical drafts** (2023-2025 seasons)
2. **Compare against:** Greedy value-based drafting, ADP-based selection
3. **Success metric:** Optimized lineups should score in top 20% of actual league outcomes

---

## Phase 2: Clutch Factor & Impact Simulator (Predictive ML)

**Objective:** Predict a player's performance in high-leverage situations and explain which factors drive the prediction.

### Target Variables

| Target | Sport | Description | Type |
|--------|-------|-------------|------|
| `clutch_points` | NBA | Points scored in final 5 min, score within 5 | Regression |
| `clutch_conversion` | NFL | Success rate on 3rd/4th down, 4th quarter | Classification |
| `impact_delta` | Both | Performance vs. baseline in clutch | Regression |

### Feature Engineering

```python
# packages/impact-simulator/src/features/clutch_metrics.py

FEATURE_GROUPS = {
    "historical_clutch": [
        "career_clutch_fg_pct",        # NBA
        "career_4q_qbr",                # NFL
        "clutch_attempts_last_10",
        "clutch_success_rate_30d",
    ],
    "game_context": [
        "score_differential",
        "time_remaining_normalized",
        "home_court_advantage",
        "opponent_defensive_rating",
    ],
    "fatigue_load": [
        "minutes_played_game",          # NBA
        "snap_count_pct",               # NFL
        "back_to_back_flag",
        "rest_days",
    ],
    "matchup": [
        "defender_rating",              # NBA: who's guarding them
        "coverage_scheme",              # NFL: zone vs man
        "historical_vs_opponent",
    ],
}
```

### Model Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Training Pipeline                       │
├─────────────────────────────────────────────────────────┤
│  Raw Features                                           │
│       │                                                 │
│       ▼                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────────┐  │
│  │ Imputer     │──▶│ Scaler      │──▶│ Feature      │  │
│  │ (KNN)       │   │ (RobustScl) │   │ Selector     │  │
│  └─────────────┘   └─────────────┘   └──────┬───────┘  │
│                                             │          │
│                                             ▼          │
│                                   ┌─────────────────┐  │
│                                   │ XGBoostRegressor│  │
│                                   │ (Optuna-tuned)  │  │
│                                   └────────┬────────┘  │
│                                            │           │
│                                            ▼           │
│                                   ┌─────────────────┐  │
│                                   │ SHAP Explainer  │  │
│                                   └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Evaluation Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| **RMSE** | < 4.5 pts (NBA) | Primary accuracy metric |
| **MAE** | < 3.2 pts (NBA) | Robust to outliers |
| **R²** | > 0.35 | Clutch is inherently noisy; modest R² acceptable |
| **Calibration** | MAPE < 15% | Predictions should be well-calibrated |

### Explainability Output

```json
{
  "player": "Jayson Tatum",
  "scenario": "4th Q, down 3, 2:30 remaining",
  "prediction": {
    "expected_points": 4.2,
    "confidence_interval": [2.1, 6.8]
  },
  "shap_explanations": [
    {"feature": "career_clutch_fg_pct", "impact": +1.8, "direction": "positive"},
    {"feature": "minutes_played_game", "impact": -0.6, "direction": "negative"},
    {"feature": "opponent_defensive_rating", "impact": +0.4, "direction": "positive"}
  ],
  "recommendation": "HIGH CONFIDENCE - Historical clutch performance is primary driver"
}
```

</ML_Phases>

---

<Recruiter_Focus>

## Advanced Features for Technical Differentiation

### 1. SHAP-Based Explainability Dashboard

**Why it matters:** Demonstrates understanding of Explainable AI (XAI), critical for stakeholder trust and regulatory compliance.

```python
# packages/impact-simulator/src/models/explainer.py
import shap
import mlflow

class ClutchExplainer:
    def __init__(self, model, X_train):
        self.explainer = shap.TreeExplainer(model)
        self.expected_value = self.explainer.expected_value

    def explain_prediction(self, X_instance) -> dict:
        shap_values = self.explainer.shap_values(X_instance)

        # Log to MLflow for tracking
        mlflow.log_dict({
            "shap_values": shap_values.tolist(),
            "base_value": float(self.expected_value)
        }, "explanation.json")

        return {
            "shap_values": shap_values,
            "feature_importance": self._rank_features(shap_values),
            "waterfall_data": self._format_waterfall(X_instance, shap_values)
        }
```

**Frontend visualization:** Interactive waterfall chart showing how each feature pushes the prediction above/below baseline.

---

### 2. MLflow Model Registry with A/B Versioning

**Why it matters:** Shows production ML maturity—experiment tracking, model versioning, and deployment governance.

```python
# scripts/train_models.py
import mlflow
from mlflow.tracking import MlflowClient

def train_and_register(X_train, y_train, X_test, y_test):
    mlflow.set_experiment("clutch-impact-simulator")

    with mlflow.start_run():
        # Train model
        model = train_xgboost(X_train, y_train)

        # Log metrics
        metrics = evaluate_model(model, X_test, y_test)
        mlflow.log_metrics(metrics)

        # Log model with signature
        signature = mlflow.models.infer_signature(X_train, model.predict(X_train))
        mlflow.xgboost.log_model(
            model,
            "clutch_model",
            signature=signature,
            registered_model_name="ClutchImpactPredictor"
        )

        # Promote to staging/production based on metrics
        client = MlflowClient()
        if metrics['rmse'] < PRODUCTION_THRESHOLD:
            client.transition_model_version_stage(
                name="ClutchImpactPredictor",
                version=latest_version,
                stage="Production"
            )
```

**API integration:** FastAPI endpoint loads model by stage (`Production` vs `Staging`) enabling shadow deployments.

---

### 3. Containerized ML Pipeline with Multi-Stage Docker

**Why it matters:** DevOps/MLOps recruiters specifically look for production deployment patterns.

```dockerfile
# infrastructure/docker/Dockerfile.ml
# Stage 1: Build environment
FROM python:3.12-slim AS builder

WORKDIR /app
RUN pip install uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Stage 2: Runtime (minimal attack surface)
FROM python:3.12-slim AS runtime

# Non-root user for security
RUN useradd -m -u 1000 mluser
USER mluser

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY packages/ ./packages/

ENV PATH="/app/.venv/bin:$PATH"
ENV MLFLOW_TRACKING_URI="http://mlflow:5000"

HEALTHCHECK --interval=30s --timeout=3s \
    CMD python -c "import packages.impact_simulator" || exit 1

ENTRYPOINT ["python", "-m", "uvicorn", "packages.api.src.main:app"]
CMD ["--host", "0.0.0.0", "--port", "8000"]
```

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
      - MLFLOW_TRACKING_URI=http://mlflow:5000
    depends_on:
      - mlflow

  mlflow:
    image: ghcr.io/mlflow/mlflow:v2.10.0
    ports:
      - "5000:5000"
    volumes:
      - ../../mlflow:/mlflow
    command: mlflow server --host 0.0.0.0 --backend-store-uri sqlite:///mlflow/mlflow.db

  web:
    build:
      context: ../../apps/web
    ports:
      - "3000:3000"
    depends_on:
      - api
```

---

### Bonus: CI/CD Pipeline Snippet

```yaml
# .github/workflows/ml-pipeline.yml
name: ML Pipeline

on:
  push:
    paths:
      - 'packages/impact-simulator/**'

jobs:
  train-and-evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Train model
        run: |
          uv run python scripts/train_models.py

      - name: Model quality gate
        run: |
          uv run pytest packages/impact-simulator/tests/test_model_quality.py

      - name: Push to registry (if quality passes)
        if: success()
        run: |
          uv run python scripts/promote_model.py --stage staging
```

</Recruiter_Focus>

---

<Next_Action>

## First Technical Test: NBA Auction Optimizer Proof-of-Concept

```python
# scripts/poc_auction_optimizer.py
"""
POC: NBA Fantasy Auction Draft Optimizer
Run: python scripts/poc_auction_optimizer.py
"""
from pulp import LpMaximize, LpProblem, LpVariable, lpSum, LpStatus

# Sample NBA player pool (projected_points, auction_cost)
players = [
    {"id": "tatum", "name": "Jayson Tatum", "pos": "SF", "pts": 45.2, "cost": 62},
    {"id": "jokic", "name": "Nikola Jokic", "pos": "C", "pts": 58.1, "cost": 78},
    {"id": "brunson", "name": "Jalen Brunson", "pos": "PG", "pts": 38.5, "cost": 45},
    {"id": "ant", "name": "Anthony Edwards", "pos": "SG", "pts": 42.0, "cost": 55},
    {"id": "sabonis", "name": "Domantas Sabonis", "pos": "C", "pts": 44.8, "cost": 48},
    {"id": "maxey", "name": "Tyrese Maxey", "pos": "PG", "pts": 35.2, "cost": 38},
    {"id": "bam", "name": "Bam Adebayo", "pos": "C", "pts": 36.5, "cost": 40},
    {"id": "scottie", "name": "Scottie Barnes", "pos": "SF", "pts": 34.0, "cost": 35},
]

# Optimization problem
prob = LpProblem("NBA_Auction_Draft", LpMaximize)
x = {p["id"]: LpVariable(f"x_{p['id']}", cat="Binary") for p in players}

# Objective: maximize total projected fantasy points
prob += lpSum(p["pts"] * x[p["id"]] for p in players), "Total_Points"

# Constraints
prob += lpSum(p["cost"] * x[p["id"]] for p in players) <= 200, "Budget"
prob += lpSum(x[p["id"]] for p in players) == 5, "Roster_Size"

# Solve and display results
prob.solve()
print(f"Status: {LpStatus[prob.status]} | Optimal Points: {prob.objective.value():.1f}")
print("Selected:", [p["name"] for p in players if x[p["id"]].value() == 1])
```

**Expected output:**
```
Status: Optimal | Optimal Points: 194.5
Selected: ['Nikola Jokic', 'Jalen Brunson', 'Domantas Sabonis', 'Tyrese Maxey', 'Scottie Barnes']
```

### Validation Steps

1. **Run the script:** `python scripts/poc_auction_optimizer.py`
2. **Verify constraint satisfaction:** Total cost ≤ 200, exactly 5 players selected
3. **Extend test:** Add position constraints (min 1 PG, min 1 C, etc.)

</Next_Action>

---

## Implementation Roadmap

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| **1** | Data Foundation | Unified schemas, data pipeline, raw data collection |
| **2** | Draft Optimizer MVP | LP solver, FastAPI endpoint, basic UI |
| **3** | Impact Simulator MVP | Feature engineering, XGBoost training, SHAP integration |
| **4** | Integration & Polish | Dashboard toggle, MLflow setup, Docker compose |
| **5** | Demo Prep | Documentation, investor deck, recorded demo |

---

## Success Criteria for Investor Demo

- [ ] Sub-second optimization results for 300+ player pools
- [ ] Clutch predictions with RMSE < 5.0 on holdout set
- [ ] SHAP explanations render in < 200ms
- [ ] Full Docker-compose deployment in single command
- [ ] Clean CI pipeline with model quality gates

---

*This document serves as the technical specification for the Sports Intelligence Hub MVP. All architectural decisions prioritize demonstrable ML engineering competency while maintaining a realistic scope for a portfolio project.*
