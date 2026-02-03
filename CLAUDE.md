# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sports Intelligence Hub - an ML platform for NBA game predictions and fantasy draft optimization. Built as a recruiter demo showcasing end-to-end ML engineering.

## Why uv Instead of pip/poetry/conda?

We use **uv** (by Astral, the ruff team) for Python package management because:

1. **Speed**: 10-100x faster than pip. Installs dependencies in seconds, not minutes.
2. **Monorepo support**: Native workspace feature lets multiple packages (`core`, `api`) share dependencies and reference each other.
3. **No manual venv**: `uv sync` creates `.venv` automatically. `uv run <cmd>` uses it without needing `source .venv/bin/activate`.
4. **Lockfile**: `uv.lock` ensures reproducible builds across machines.
5. **Modern**: Replaces pip, pip-tools, virtualenv, and poetry with one tool.

**Key difference from pip:**
```bash
# Traditional workflow
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python script.py

# uv workflow
uv sync --all-packages   # creates .venv + installs everything
uv run python script.py  # runs in .venv automatically
```

## Commands

```bash
# Install all dependencies (creates .venv automatically)
make install
# or: uv sync --all-packages

# Run API server (localhost:8000)
make dev
# or: uv run uvicorn api.main:app --reload --port 8000

# Run tests
make test
# or: uv run pytest -v

# Lint code
make lint
```

## Project Structure

```
sports-intelligence-hub/
├── pyproject.toml          # Root workspace config
├── packages/
│   ├── core/               # Shared library (schemas, DB, utils)
│   │   ├── core/           # Python package
│   │   └── tests/
│   └── api/                # FastAPI backend
│       ├── api/            # Python package
│       └── tests/
├── data/                   # Raw/processed data (gitignored)
├── notebooks/              # Jupyter exploration
├── scripts/                # Training scripts
└── infrastructure/docker/  # Docker Compose for PostgreSQL, MLflow
```

**Why this structure?**
- `packages/` contains isolated, testable Python packages
- Each package has its own `pyproject.toml` with dependencies
- Packages can import each other: `from core.schemas import PlayerSchema`
- Tests live next to the code they test

## Workspace Dependencies

When one package depends on another (e.g., `api` depends on `core`), declare it in `pyproject.toml`:

```toml
# packages/api/pyproject.toml
[project]
dependencies = ["core"]

[tool.uv.sources]
core = { workspace = true }  # tells uv it's a local package
```

## VSCode Setup

If VSCode shows import errors (red squiggles), it's not using the right Python interpreter.

Fix: `Cmd+Shift+P` → "Python: Select Interpreter" → `.venv/bin/python`

Or the `.vscode/settings.json` file should auto-configure this.

## Tech Stack

- **Package Manager**: uv (fast, modern pip replacement)
- **API**: FastAPI + uvicorn
- **Database**: PostgreSQL (via Docker)
- **ML**: XGBoost, scikit-learn, SHAP
- **Data**: nba_api, pandas
- **Experiment Tracking**: MLflow
- **LLM**: Gemini API (for scouting reports)

## Implementation Phases

Per the PRD, we're building incrementally:

1. **Foundation** (current) - Monorepo setup, schemas, API skeleton
2. **Draft Optimizer** - Player projections + LP optimization
3. **Game Predictor** - XGBoost classifier + SHAP explanations
4. **LLM Integration** - Gemini streaming scouting reports
5. **Auth & Polish** - OAuth, admin dashboard, Docker deployment
