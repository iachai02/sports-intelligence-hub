# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sports Intelligence Hub - an ML platform for NBA game predictions and fantasy draft optimization. Built as a recruiter demo showcasing end-to-end ML engineering. See `prd.md` for full requirements.

**Key Technologies:** Python 3.11+, FastAPI, PostgreSQL, SQLAlchemy, Alembic, PuLP (LP optimization), XGBoost, MLflow, React, uv (package manager)

**Monorepo Structure:** Three packages in `packages/` + React frontend in `apps/web/`

## Current Status: Enhanced Projection Model ✅

**Completed Features:**
- ✅ Real NBA API integration (free, via `nba_api` library)
- ✅ **Enhanced projection pipeline** — ~61 features (demographics, advanced stats, team context, derived metrics), up from 33
- ✅ **Auction value with age/durability adjustments** — exponential age decline (0.9^years_over_33), multi-season GP average, GP trend penalty
- ✅ **Mid-season blending** — blends XGBoost projection with current-season actuals (weight = min(0.85, games/50))
- ✅ **3 new NBA API endpoints** — `LeagueDashPlayerBioStats`, `PlayerEstimatedMetrics`, `TeamEstimatedMetrics`
- ✅ XGBoost projection model trained on 3 seasons of real data (model in `models/player_projector/`)
- ✅ **XGBoost projections wired to Draft Room + Player Stats** — season/view toggle (2022-23, 2023-24, 2024-25 actuals or 2025-26 projected)
- ✅ Category-Aware Recommendations with filters and scoring modes
- ✅ Search Typeahead with 300ms debounce and request cancellation
- ✅ Taken Players Panel, Expandable player stats (9-cat grid)
- ✅ Light/Dark Theme Toggle with localStorage persistence
- ✅ **Google OAuth Authentication** with PKCE flow
- ✅ **Draft Session Persistence to PostgreSQL**
- ✅ Alembic migration infrastructure
- ✅ Session picker UI (create, resume, delete sessions)
- ✅ Auth-gated Draft Room (must sign in to access)
- ✅ Skipped players persisted to DB
- ✅ Undo works across page refreshes (DB-level)
- ✅ Player pool cached per server lifecycle (projection_service has its own `_projected_pool_cache`)
- ✅ 111 tests passing
- ✅ **Global Navigation Bar** (Round 3) — persistent top nav with NavLink active styling
- ✅ **Dashboard Page** — rooms list, aggregated activity feed, quick links
- ✅ **Room persistence across navigation** — sessionStorage remembers active room when switching pages
- ✅ **Collapsible Category Strengths** — toggle to show/hide, matches Filters & Scoring pattern

**Most Recent Session (2026-02-05) - Enhanced Projection Model:**

Implemented a 7-phase plan to improve the projection model (Wembanyama BPG was 1.5 projected vs 3.6 actual). Added richer features, enhanced data pipeline, auction value age/durability adjustments, mid-season blending.

**Key Files Changed/Created:**

| File | What |
|------|------|
| `packages/core/core/utils/data_loader.py` | Added `get_player_bio_stats()`, `get_player_estimated_metrics()`, `get_team_estimated_metrics()` |
| `packages/core/core/services/player_stats_service.py` | Added `get_enhanced_projection_data()` — joins base stats with bio, advanced, team metrics. Maps `TEAM_ID` → abbreviation via `nba_api.stats.static.teams`. |
| `packages/draft-optimizer/draft_optimizer/ml/features.py` | Rewrote `ProjectionFeatureBuilder` for ~61 features with backward compat. New: demographics, advanced stats, team context, derived per-minute rates, trajectory features. |
| `packages/draft-optimizer/draft_optimizer/features.py` | `calculate_auction_value_v2()` — added `age`, `avg_games_played`, `games_played_trend` params. Exponential age curve, power-law GP scaling, GP trend penalty. |
| `packages/draft-optimizer/draft_optimizer/projection_service.py` | Updated to try enhanced data first (fallback to basic). Added `blend_mid_season()`. Passes age/GP data to auction calc. Diagnostic logging. |
| `packages/api/api/routers/players.py` | Removed buggy time-based cache. Projected data delegates to `projection_service` (which has server-lifetime cache). Actual data cached per-key. |
| `scripts/train_projection_model.py` | **NEW** training script with `--backtest` and `--tune` flags. Temporal split, expanded to 5 seasons. |
| `tests/test_features_enhanced.py` | **NEW** 22 tests for enhanced features |
| `tests/test_mid_season_blend.py` | **NEW** 12 tests for mid-season blending |
| `tests/test_auction_calibration.py` | Added `TestAgePenalty` (5 tests) and `TestDurabilityPenalty` (5 tests) |

**Enhanced Projection Pipeline Flow:**
1. `load_projected_players("2025-26")` tries `get_enhanced_projection_data()` first (falls back to basic)
2. Enhanced data: base stats + bio (age, height, draft info) + player estimated metrics + team metrics
3. `ProjectionFeatureBuilder.build_inference_features()` → ~61 features (model's `config.json` selects which to use)
4. `XGBoostProjector.predict()` → 9 stat predictions per player
5. Mid-season blending if target season has partial actual data
6. `calculate_fantasy_points()` → FPTS
7. `calculate_auction_value_v2(age=, avg_games_played=, games_played_trend=)` → adjusted auction values
8. Returns `list[PlayerProjection]` sorted by auction_value desc

**Auction Value Adjustments:**
- **Age**: `age_factor = max(0.30, 0.9^(age - 33))` for age >= 33. LeBron (40) ≈ 0.48x, 35yo ≈ 0.80x
- **Durability**: Uses multi-season avg GP. `(gp/70)^1.3` power-law scaling. Floor at 30%.
- **GP Trend**: Extra 0.3% penalty per game drop beyond -5, capped at 9%

**Caching Architecture (important — was a source of bugs):**
- `projection_service.py` has `_projected_pool_cache` (server-lifetime, keyed by target_season)
- `session_persistence.py` has `_player_pool_cache` (server-lifetime, keyed by `"{season}_{view}"`)
- `players.py` has `_actual_player_cache` (server-lifetime, actual data only). Projected data delegates to `projection_service` directly.
- `data_loader.py` has `diskcache` (24-hour TTL on disk, raw NBA API responses)
- **All three in-memory caches clear on server restart.** The diskcache persists on disk.

**Bugs Fixed During This Session:**
1. `LeagueDashPlayerBioStats` used wrong param `league_id_nullable` → fixed to `league_id`
2. `age` was not passed to `calculate_auction_value_v2()` → added extraction from enhanced data
3. `TeamEstimatedMetrics` returns `TEAM_ID`/`TEAM_NAME` but NOT `TEAM_ABBREVIATION` → added mapping via `nba_api.stats.static.teams.get_teams()`
4. `players.py` had a broken shared `_cache_timestamp` causing Draft Room and Player Stats to show different values → removed time-based cache, delegate projected data to projection_service's own cache

**Note:** The current trained model in `models/player_projector/` still uses 33 features. To use the new 61 features, need to retrain: `uv run python scripts/train_projection_model.py --backtest`. The backward compat design means the old model still works (selects its 33 columns from the ~61 available).

**Note:** React StrictMode causes double API calls in development (mount-unmount-remount). This is normal and does not happen in production builds.

---

**Previous Sessions (summarized):**
- **Round 3: Global Nav + Dashboard** — `GlobalNavBar.tsx`, `DashboardPage.tsx`, room persistence via sessionStorage, activity feed improvements
- **Phase 2: Session Persistence** — DB-backed draft sessions (DraftSession, DraftPick, TakenPlayer, SkippedPlayer, SessionPreferences models). Pattern: load from DB → reconstruct DraftState → persist mutations. Migration `5d751b19e16d`.
- **Phase 1: Google OAuth** — Authorization Code Flow + PKCE. JWT in httpOnly cookie (`sports_hub_token`). Auth endpoints at `/api/v1/auth/*`. Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `VITE_GOOGLE_CLIENT_ID`.
- **Theme System** — Light/dark mode via ThemeContext + CSS variables
- **Draft Room UI/UX** — Stable prices, expandable stats, taken panel, category strengths, filters/scoring modes, skip button

## Commands

```bash
# First time setup
make install              # Install all dependencies (creates .venv)
make docker-up            # Start PostgreSQL + MLflow
brew install libomp       # Required for XGBoost on macOS

# Development
make dev                  # Run API at localhost:8000
make test                 # Run all tests (use: uv run pytest -v packages/)
make lint                 # Run ruff + mypy

# Database migrations
make migrate              # Apply migrations (alembic upgrade head)
make migrate-create msg="description"  # Create new migration

# Web app
cd apps/web && npm install
cd apps/web && npm run dev -- --port 3001  # Run React app at localhost:3001

# Data ingestion (fetch real NBA stats)
uv run python -m core.cli.ingest_data --seasons 2024-25

# Docker
make docker-down          # Stop containers
```

## Development Workflow

**IMPORTANT: Always run `make lint` after making code changes.**

```bash
make lint                 # Must pass before committing (3 pre-existing E402 in main.py are expected)
uv run pytest -v packages/  # Verify tests still pass (111 tests)
cd apps/web && npm run build  # Check TypeScript compiles
```

## Project Structure

```
sports-intelligence-hub/
├── packages/
│   ├── core/                   # Shared library
│   │   ├── core/
│   │   │   ├── db/models.py              # SQLAlchemy models (User, Player, DraftSession, DraftPick, TakenPlayer, SkippedPlayer, SessionPreferences)
│   │   │   ├── db/connection.py          # get_db_url(), get_engine(), get_session()
│   │   │   └── services/player_stats_service.py  # NBA data fetching
│   │   ├── alembic/                      # Migration infrastructure
│   │   │   ├── env.py                    # Imports Base.metadata, get_db_url()
│   │   │   ├── script.py.mako           # Migration template
│   │   │   └── versions/                 # Migration files
│   │   └── alembic.ini                   # Alembic config
│   ├── draft-optimizer/        # Fantasy draft optimization + ML
│   │   └── draft_optimizer/
│   │       ├── schemas.py      # PlayerProjection, RosterConfig, CategoryAwareRecommendation, etc.
│   │       ├── features.py     # Fantasy scoring, auction values
│   │       ├── draft_room.py   # DraftState class (computation engine, no persistence)
│   │       ├── session_persistence.py  # DB persistence layer (create, load, persist, undo)
│   │       ├── projection_service.py  # XGBoost inference pipeline (wired to draft room + player stats)
│   │       ├── real_data.py    # Load real NBA players from API
│   │       └── ml/
│   │           ├── features.py     # ProjectionFeatureBuilder (~61 features), STAT_TARGETS
│   │           └── projector.py    # XGBoost model loading + prediction
│   └── api/
│       └── api/
│           ├── auth/                     # Authentication module
│           │   ├── config.py             # Auth settings from env
│           │   ├── jwt.py                # JWT creation/verification
│           │   ├── oauth.py              # Google OAuth code exchange
│           │   └── dependencies.py       # get_current_user, get_optional_user
│           ├── routers/
│           │   ├── auth.py               # Auth endpoints (/api/v1/auth/*)
│           │   ├── draft_sessions.py     # Draft session endpoints (/api/v1/draft-sessions/*)
│           │   ├── rooms.py              # Room management (/api/v1/rooms/*)
│           │   ├── draft.py              # Roster optimization endpoints
│           │   └── players.py            # Player stats endpoints
│           └── main.py                   # FastAPI app factory
├── apps/web/
│   └── src/
│       ├── contexts/
│       │   ├── ThemeContext.tsx          # Light/dark theme state
│       │   └── AuthContext.tsx           # Auth state (user, login, logout)
│       ├── hooks/
│       │   └── useGoogleAuth.ts          # PKCE OAuth flow
│       ├── pages/
│       │   ├── DraftRoom.tsx             # Draft assistant page (auth-gated, sessionStorage room persistence)
│       │   ├── DashboardPage.tsx         # Dashboard with rooms list, activity feed, quick links
│       │   ├── PlayerStats.tsx           # Player stats browser page
│       │   └── AuthCallback.tsx          # OAuth callback handler
│       ├── components/
│       │   ├── GlobalNavBar.tsx          # Persistent top nav bar (NavLink, auth, theme)
│       │   ├── ThemeToggle.tsx           # Sun/Moon toggle button
│       │   ├── AuthButton.tsx            # Sign in/out with avatar
│       │   ├── draft-room/
│       │   │   ├── SessionPicker.tsx     # Session list + create form
│       │   │   ├── RecommendationsPanel.tsx  # Collapsible filters + category strengths
│       │   │   ├── TakenPlayersPanel.tsx
│       │   │   ├── PlayerSearch.tsx
│       │   │   ├── MyRoster.tsx
│       │   │   └── BudgetTracker.tsx
│       │   └── player-stats/
│       │       ├── PlayerStatsTable.tsx
│       │       ├── PlayerStatsFilters.tsx
│       │       ├── PlayerDetailModal.tsx
│       │       └── PlayerComparisonView.tsx
│       ├── lib/
│       │   ├── api.ts                    # Draft session API calls (all with credentials: 'include')
│       │   ├── auth.ts                   # Auth API calls
│       │   ├── types.ts                  # TypeScript types (DraftSessionListItem, User, etc.)
│       │   └── utils.ts
│       ├── index.css                     # Theme CSS variables (light/dark)
│       └── tailwind.config.js            # Semantic color tokens
├── scripts/
│   └── train_projection_model.py  # Training script (--backtest, --tune flags)
└── models/player_projector/  # Trained XGBoost model (33 features, needs retrain for 61)
```

## API Endpoints

### Draft Sessions (all require auth)

```bash
# Session management
GET    /api/v1/draft-sessions/              # List user's sessions
POST   /api/v1/draft-sessions/              # Create new session {name, budget, num_teams, season}
GET    /api/v1/draft-sessions/{id}          # Get session state (?view=actual|projected)
PATCH  /api/v1/draft-sessions/{id}          # Update session {name, status}
DELETE /api/v1/draft-sessions/{id}          # Delete session (cascades)

# Draft actions
POST   /api/v1/draft-sessions/{id}/draft   # Draft player {player_id, cost, slot?}
POST   /api/v1/draft-sessions/{id}/taken   # Mark taken {player_id}
POST   /api/v1/draft-sessions/{id}/skip    # Skip player {player_id, reason?}
POST   /api/v1/draft-sessions/{id}/undo    # Undo last action (DB-level timestamp comparison)

# Recommendations & search
GET    /api/v1/draft-sessions/{id}/recommendations  # Category-aware recs (?view=actual|projected)
GET    /api/v1/draft-sessions/{id}/search            # Player search by name (?view=actual|projected)
```

### Recommendations Query Parameters

```bash
GET /api/v1/draft-sessions/{id}/recommendations
  ?top_n=10
  &position=PG                    # Filter by position
  &scoring_mode=balanced          # balanced | value | production
  &min_cost=5                     # Min auction value
  &max_cost=50                    # Max auction value
  &min_fpts=20                    # Min projected FPTS
  &max_fpts=60                    # Max projected FPTS
  &affordability=affordable,stretch  # Comma-separated tags
  &skipped_ids=nba_123,nba_456   # Additional skipped IDs (merged with DB skipped)
```

## Key Implementation Details

### Session Persistence Pattern (session_persistence.py)

```python
# Create: DB record + load player pool (cached) → return (DraftSession, DraftState)
db_session, draft_state = create_db_session(db, user_id, name, budget, ...)

# Load: Read DB → reconstruct DraftState by replaying picks + taken
draft_state = load_draft_state(db, session_id, view="actual")
# Internally: loads player pool (cached), replays picks in order, replays taken players, clears action history

# Persist mutations individually after validation
persist_draft_pick(db, session_id, player_id, price, slot, ...)
persist_taken_player(db, session_id, player_id)
persist_skipped_player(db, session_id, player_id, reason)

# Undo: compare timestamps, delete newer
undo_last_action(db, session_id)  # Returns {action_type, player_id} or None

# Player pool cache: dict["{season}_{view}", list[PlayerProjection]]
# e.g. "2024-25_actual", "2025-26_projected"
# view="actual" → load_real_players_from_api(), view="projected" → load_projected_players()
# Each combo called once per server lifecycle
```

### Category-Aware Recommendations Algorithm (draft_room.py)

**Roster Strength with Scaling:**
```python
# League averages scale by roster progress
filled_slots = len(my_roster)
if filled_slots > 0:
    scaled_mean = full_mean * (filled_slots / roster_size)
    scaled_std = full_std * math.sqrt(filled_slots / roster_size)

z_score = (team_total - scaled_mean) / scaled_std
# > 1.0 = strong, < -1.0 = weak, else average
```

**Composite Scoring:**
```python
composite = (
    category_fit_score * w["fit"]
    + fpts_norm * w["fpts"]
    + value_norm * w["value"]
    + fpts_per_dollar_norm * w["fpts_per_dollar"]
)
```

**Scoring Mode Weights:**
| Mode | Fit | FPTS | Value | FPTS/$ |
|------|-----|------|-------|--------|
| balanced | 25% | 25% | 25% | 25% |
| value | 20% | 20% | 20% | 40% |
| production | 20% | 40% | 20% | 20% |

**Early Draft Mode:** Only with `roster_size == 0`. Shows best FPTS players. Once any player drafted, full category analysis kicks in.

**Affordability Tags:** `affordable` (≤40% budget), `stretch` (>40% budget)

### Frontend DraftRoom Flow

```
Auth loading? → show spinner
Not authenticated? → show "Sign in" with AuthButton
No session selected? → show SessionPicker (list + create)
Session selected? → show full draft room UI (3-column layout)
  - "Sessions" button returns to SessionPicker
```

```typescript
// sessionId is now number (PostgreSQL serial), not string (UUID)
const [sessionId, setSessionId] = useState<number | null>(null);

// Skipped players persisted via API (no longer local Set)
const handleSkip = async (playerId: string) => {
  await skipPlayer(sessionId, playerId);
  await refreshState(sessionId, filters);
};
```

## Testing Verification

After changes, verify:
1. `uv run ruff check packages/` passes (3 pre-existing E402 in main.py expected)
2. `uv run mypy packages/` passes
3. `uv run pytest -v packages/` passes (111 tests)
4. `cd apps/web && npm run build` compiles

Manual testing:
1. Start Docker: `make docker-up`
2. Start API: `make dev`
3. Start web: `cd apps/web && npm run dev -- --port 3001`
4. Sign in with Google OAuth
5. Create new draft session (first time loads NBA API data, takes a few seconds)
6. Draft players → close browser → reopen → resume session with state intact
7. Undo works across page refreshes
8. Skipped players persist across refreshes

## Environment Variables

```bash
# Backend .env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
JWT_SECRET=<generate with: openssl rand -base64 32>

# Frontend apps/web/.env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Common Issues

**"Not authenticated" on all draft endpoints:** All `/api/v1/draft-sessions/` endpoints require auth. Frontend sends `credentials: 'include'` on all fetch calls. Make sure the JWT cookie (`sports_hub_token`) is set via the OAuth flow.

**First session creation slow:** The NBA API player pool is fetched on first create. Subsequent sessions for the same season use the cache.

**Pre-existing ruff E402 errors in main.py:** The `load_dotenv()` must run before module imports. These 3 E402 errors are expected and pre-date Phase 2.

**OAuth "Could not determine client ID":** `load_dotenv()` must run BEFORE importing auth modules. Check `main.py`.

**OAuth 400 Bad Request:** Check `invalid_grant` (code reused/expired), `redirect_uri_mismatch`, `invalid_client`.

**Dark mode not applying to form elements:** Global CSS rules in `index.css` handle native form elements. Use `bg-input` class for custom inputs.

## Theme System Reference

```tsx
// Backgrounds
className="bg-background"     // Page background
className="bg-card"           // Cards, panels, modals
className="bg-muted"          // Subtle backgrounds, hover states
className="bg-input"          // Form inputs

// Text
className="text-foreground"         // Primary text
className="text-muted-foreground"   // Secondary text
className="text-accent"             // Links, emphasis

// Borders & Status
className="border-border"
className="text-stat-positive"  // Green
className="text-stat-negative"  // Red
```

## Future Work

1. **Retrain model with 61 features** - Run `uv run python scripts/train_projection_model.py --backtest`. Current model uses 33 features. Expected R2 improvement from 0.674 to ~0.78+. Wembanyama BPG should improve from 1.5 to ~3.2-3.5. The pipeline is backward compatible (old model works with new features, new model uses all 61).
2. **Volume stats** - Add total stats (not just per-game) to better evaluate player impact
3. **Clear skipped players endpoint** - Bulk delete skipped players for a session
4. **Persist session preferences** - Read/write filter preferences from `session_preferences` table
5. **Game predictor** - Use XGBoost classifier for game outcomes
6. **LLM scouting reports** - Integrate Gemini API

## Learning Session Notes (2026-02-04)

**Architecture:** Layer 1 entry: `ingest_data.py` → `player_stats_service.py` → `data_loader.py`. Caching with `diskcache` in `data_loader.py`.

**Feature Engineering:** FG%/FT% bonuses use total made/attempted. Age adjustment only in auction value, not FPTS. FPTS = pure stats; Auction Value = FPTS + externals.

**ML:** XGBoost uses gradient boosting (sequential trees), not backprop. 9 separate models. Need min 2 seasons for training.

**Infrastructure:** Port 5001 MLflow, 5432 PostgreSQL, 8000 API, 3001 frontend.
