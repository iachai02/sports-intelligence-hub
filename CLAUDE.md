# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sports Intelligence Hub - an ML platform for NBA game predictions and fantasy draft optimization. Built as a recruiter demo showcasing end-to-end ML engineering. See `prd.md` for full requirements.

**Key Technologies:** Python 3.11+, FastAPI, PostgreSQL, SQLAlchemy, PuLP (LP optimization), XGBoost, uv (package manager)

**Monorepo Structure:** Three packages in `packages/` - `core` (shared), `api` (FastAPI), `draft-optimizer` (ML + optimization)

## Current Status: Phase 2 In Progress 🔧

**Phase 1 Complete:**
- Monorepo structure with `uv` workspaces
- PostgreSQL + MLflow via Docker Compose
- Database models (`Player`, `Game`, `PlayerGameStats`, `GamePrediction`)
- NBA data loader with caching (fetches from nba_api)
- FastAPI with health + readiness endpoints

**Phase 2 Progress (Draft Optimizer):**
- ✅ Package structure (`packages/draft-optimizer/`)
- ✅ 9-category fantasy scoring system
- ✅ PuLP optimization solver (13 roster, $200 budget, custom configs)
- ✅ Draft optimizer API endpoints
- ✅ 33 tests passing
- ⏳ XGBoost projection model (using mock projections for now)
- ⏳ React UI for draft tool

**Next:** Train XGBoost model on real NBA data, then build React UI

## Commands

```bash
# First time setup
make install              # Install all dependencies (creates .venv)
make docker-up            # Start PostgreSQL + MLflow

# Development
make dev                  # Run API at localhost:8000
make test                 # Run all tests (33 tests)
make lint                 # Run ruff + mypy

# Docker
make docker-down          # Stop containers
docker logs sports_hub_db # Check PostgreSQL logs
```

## Development Workflow

**IMPORTANT: Always run `make lint` after making code changes.**

```bash
# After any code changes:
make lint                 # Must pass before committing
make test                 # Verify tests still pass
```

The linter runs:
- **ruff**: Fast Python linter (import sorting, unused imports, code style)
- **mypy**: Static type checking (strict mode enabled)

## Docker Services

```bash
# Start services
docker compose -f infrastructure/docker/docker-compose.yml up -d

# Services:
# - PostgreSQL: localhost:5432 (user/pass/sports_hub)
# - MLflow UI: localhost:5001
```

**Database URL:** `postgresql://user:pass@localhost:5432/sports_hub`

## Project Structure

```
sports-intelligence-hub/
├── pyproject.toml              # Root workspace config (uv)
├── .env                        # Environment variables (DATABASE_URL, etc.)
├── Makefile                    # Dev commands
├── packages/
│   ├── core/                   # Shared library
│   │   ├── core/
│   │   │   ├── schemas/        # Pydantic models (PlayerSchema, GameSchema)
│   │   │   ├── db/             # SQLAlchemy models + connection
│   │   │   │   ├── models.py   # Player, Game, PlayerGameStats, GamePrediction
│   │   │   │   └── connection.py
│   │   │   └── utils/
│   │   │       └── data_loader.py  # NBADataLoader (fetches from nba_api)
│   │   └── tests/
│   ├── draft-optimizer/        # Fantasy draft optimization
│   │   ├── draft_optimizer/
│   │   │   ├── schemas.py      # RosterConfig, PlayerProjection, RosterSlot
│   │   │   ├── features.py     # 9-cat fantasy scoring, auction values
│   │   │   ├── optimizer.py    # PuLP LP solver
│   │   │   └── mock_data.py    # Test data generation
│   │   └── tests/
│   └── api/                    # FastAPI backend
│       ├── api/
│       │   ├── main.py         # App factory, loads .env
│       │   └── routers/
│       │       ├── health.py   # /api/v1/health, /api/v1/health/ready
│       │       └── draft.py    # /api/v1/draft/* endpoints
│       └── tests/
├── infrastructure/docker/
│   └── docker-compose.yml      # PostgreSQL + MLflow
└── data/cache/                 # NBA API response cache (gitignored)
```

## API Endpoints

```
# Health
GET  /api/v1/health              → {"status": "healthy"}
GET  /api/v1/health/ready        → {"status": "ready", "checks": {"database": "healthy"}}

# Draft Optimizer
POST /api/v1/draft/optimize      → Optimize roster (accepts players, config, exclusions)
GET  /api/v1/draft/config/default → Default roster config (13 roster, $200)
GET  /api/v1/draft/config/slots  → Slot eligibility (PG, SG, G, etc.)
POST /api/v1/draft/mock-players  → Generate mock player pool
```

### Draft Optimizer Usage

```bash
# With mock data
curl -X POST http://localhost:8000/api/v1/draft/optimize \
  -H "Content-Type: application/json" \
  -d '{"use_mock_data": true}'

# With custom config (2 centers instead of 1C + 3UTIL)
curl -X POST http://localhost:8000/api/v1/draft/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "use_mock_data": true,
    "config": {
      "slots": ["PG","SG","G","SF","PF","F","C","C","UTIL","UTIL","BENCH","BENCH","BENCH"],
      "budget": 200
    }
  }'
```

## Why uv Instead of pip/poetry?

1. **Speed**: 10-100x faster than pip
2. **Monorepo support**: Native workspace for multiple packages
3. **No manual venv**: `uv sync` creates `.venv`, `uv run <cmd>` uses it automatically
4. **Lockfile**: `uv.lock` for reproducible builds

```bash
# uv workflow (no activate needed)
uv sync --all-packages      # Install everything
uv run pytest -v            # Run in .venv automatically
uv run python script.py     # Same
```

## Workspace Dependencies

When one package depends on another, declare in `pyproject.toml`:

```toml
# packages/api/pyproject.toml
[project]
dependencies = ["core"]

[tool.uv.sources]
core = { workspace = true }  # Local workspace package
```

## VSCode Setup

If VSCode shows import errors: `Cmd+Shift+P` → "Python: Select Interpreter" → `.venv/bin/python`

The `.vscode/settings.json` should auto-configure this.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Package Manager | uv |
| API | FastAPI + uvicorn |
| Database | PostgreSQL 16 (Docker) |
| ORM | SQLAlchemy 2.0 |
| Data Source | nba_api |
| ML (planned) | XGBoost, scikit-learn, SHAP |
| Experiment Tracking | MLflow |
| LLM (planned) | Gemini API |

## Implementation Phases

### Phase 1: Foundation ✅ COMPLETE
- [x] Monorepo structure with uv
- [x] PostgreSQL + MLflow Docker setup
- [x] Database models (Player, Game, etc.)
- [x] NBA data fetching with caching
- [x] FastAPI skeleton with health checks
- [x] Unit tests for data layer

### Phase 2: Draft Optimizer ← IN PROGRESS
- [x] Feature engineering for player projections (`packages/draft-optimizer/`)
- [ ] Train XGBoost projection model (using mock data for now)
- [x] Implement PuLP optimization solver (roster selection)
- [x] Build draft optimizer API endpoints
- [ ] Create basic React UI for draft tool

### Phase 3: Game Predictor
- [ ] Feature engineering for game prediction
- [ ] Train XGBoost classifier
- [ ] SHAP explainability (dual mode: technical + human-readable)
- [ ] MLflow experiment tracking
- [ ] Prediction API endpoints

### Phase 4: LLM Integration
- [ ] Gemini API streaming integration
- [ ] Scouting report prompts
- [ ] SSE streaming endpoint

### Phase 5: Auth & Polish
- [ ] OAuth (Google/GitHub)
- [ ] Admin dashboard
- [ ] Docker production setup

## Testing

```bash
make test  # Runs 33 tests

# Test breakdown:
# - packages/api/tests/test_health.py (2 tests) - API endpoints
# - packages/core/tests/test_schemas.py (4 tests) - Pydantic schemas
# - packages/core/tests/test_db.py (5 tests) - Database operations
# - packages/draft-optimizer/tests/test_optimizer.py (22 tests) - Draft optimizer
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `prd.md` | Full product requirements document |
| `packages/core/core/utils/data_loader.py` | NBA API fetching with cache |
| `packages/core/core/db/models.py` | SQLAlchemy ORM models |
| `packages/api/api/main.py` | FastAPI app factory |
| `packages/api/api/routers/draft.py` | Draft optimizer API endpoints |
| `packages/draft-optimizer/draft_optimizer/optimizer.py` | PuLP LP solver |
| `packages/draft-optimizer/draft_optimizer/features.py` | Fantasy scoring (9-cat) |
| `packages/draft-optimizer/draft_optimizer/schemas.py` | Roster config, player projections |
| `infrastructure/docker/docker-compose.yml` | PostgreSQL + MLflow |

## Draft Optimizer Design

The draft optimizer uses **Linear Programming (PuLP)** to maximize fantasy points within constraints.

### Fantasy Rules (User-Specified)
- **Roster Size:** 13 players (10 starters + 3 bench)
- **Budget:** $200 auction
- **Starting Lineup:** PG, SG, G (PG/SG), SF, PF, F (SF/PF), C, 3×UTIL
- **Custom configs supported** (e.g., 2 centers instead of 1C + 3UTIL)

### 9-Category Scoring
```
Fantasy Points = points×1.0 + rebounds×1.2 + assists×1.5
               + steals×3.0 + blocks×3.0 - turnovers×1.0
               + three_made×0.5 + FG%_bonus + FT%_bonus
```

### LP Formulation
- **Objective:** Maximize Σ(projected_fpts × x[player, slot])
- **Constraints:**
  - Each slot filled exactly once
  - Each player used at most once (across all slots)
  - Position eligibility (PG can't fill C slot)
  - Budget ≤ $200
  - Locked players must be selected

### Current State
- Using **mock player data** for testing (realistic NBA archetypes)
- **Next:** Train XGBoost model on real NBA stats for actual projections

## Common Issues

**"No module named X"**: Run `make install` or `uv sync --all-packages`

**VSCode red squiggles**: Select correct interpreter (`.venv/bin/python`)

**Port 5000 in use (macOS)**: MLflow uses 5001 instead (AirPlay uses 5000)

**Database not connecting**: Run `make docker-up` first
