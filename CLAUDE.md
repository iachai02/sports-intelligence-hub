# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sports Intelligence Hub - an ML platform for NBA game predictions and fantasy draft optimization. Built as a recruiter demo showcasing end-to-end ML engineering. See `prd.md` for full requirements.

**Key Technologies:** Python 3.11+, FastAPI, PostgreSQL, SQLAlchemy, Alembic, PuLP (LP optimization), XGBoost, MLflow, React, uv (package manager)

**Monorepo Structure:** Three packages in `packages/` + React frontend in `apps/web/`

## Current Status: Session Persistence Implemented ✅

**Completed Features:**
- ✅ Real NBA API integration (free, via `nba_api` library)
- ✅ Auction value calculation with age, games played, and volume adjustments
- ✅ XGBoost projection model trained on 3 seasons of real data
- ✅ Category-Aware Recommendations with filters and scoring modes
- ✅ Search Typeahead with 300ms debounce and request cancellation
- ✅ Taken Players Panel
- ✅ Expandable player stats (9-cat grid)
- ✅ Light/Dark Theme Toggle with localStorage persistence
- ✅ **Google OAuth Authentication** with PKCE flow (Phase 1)
- ✅ **Draft Session Persistence to PostgreSQL** (Phase 2)
- ✅ Alembic migration infrastructure
- ✅ Session picker UI (create, resume, delete sessions)
- ✅ Auth-gated Draft Room (must sign in to access)
- ✅ Skipped players persisted to DB
- ✅ Undo works across page refreshes (DB-level)
- ✅ Player pool cached per season (NBA API called once per server lifecycle)
- ✅ 67 tests passing

**Most Recent Session (2026-02-05) - Phase 2: Session Persistence:**

Replaced in-memory draft sessions with database-backed persistence. Auth required for all draft endpoints. `DraftState` class remains the computation engine — the DB is the persistence layer. Pattern: **load from DB → reconstruct DraftState → compute → persist mutations back**.

**Key Architecture Decisions:**
- `DraftState` (in `draft_room.py`) is never persisted directly — it's reconstructed each request by replaying picks + taken players from DB
- Player pool is cached in-memory per season in `session_persistence.py` (`_player_pool_cache` dict)
- Undo compares timestamps of last pick vs last taken player in DB, deletes the newer one
- Skipped players are persisted to DB and auto-loaded in recommendations (merged with any explicit `skipped_ids` param)
- `sessionId` changed from `string` (UUID) to `number` (PostgreSQL serial) throughout frontend and API

**Backend Changes:**
- `packages/core/core/db/models.py` — Added 5 models: `DraftSession`, `DraftPick`, `TakenPlayer`, `SkippedPlayer`, `SessionPreferences` (all CASCADE delete from parent)
- `packages/core/alembic/` — Alembic migration infrastructure (env.py, script.py.mako, versions/)
- `packages/core/alembic.ini` — Alembic config (reads DB URL from `get_db_url()`)
- `packages/draft-optimizer/draft_optimizer/session_persistence.py` — **NEW** persistence service with `create_db_session()`, `load_draft_state()`, `persist_draft_pick()`, `persist_taken_player()`, `persist_skipped_player()`, `undo_last_action()`, `list_user_sessions()`, `get_db_session_record()`, `delete_db_session()`, `get_skipped_player_ids()`
- `packages/draft-optimizer/draft_optimizer/draft_room.py` — Removed module-level `_sessions` dict and `create_session()`, `get_session()`, `delete_session()`, `list_sessions()` functions. `DraftState` class unchanged.
- `packages/api/api/routers/draft_sessions.py` — **NEW** router replacing old `draft_room.py`. All endpoints require `get_current_user` auth dependency.
- `packages/api/api/routers/draft_room.py` — **DELETED** (replaced by `draft_sessions.py`)
- `packages/api/api/main.py` — Updated to register `draft_sessions` router instead of `draft_room`

**Frontend Changes:**
- `apps/web/src/lib/api.ts` — Added `credentials: 'include'` to ALL fetch calls, changed URLs from `/api/v1/draft-room/session/...` to `/api/v1/draft-sessions/...`, changed `sessionId` type from `string` to `number`, added `listDraftSessions()`, `skipPlayer()`, `deleteDraftSession()`, `updateDraftSession()`
- `apps/web/src/lib/types.ts` — Added `DraftSessionListItem` interface, changed `session_id` from `string` to `number` in `DraftState` and `CreateSessionResponse`
- `apps/web/src/pages/DraftRoom.tsx` — Auth gate (sign in required), session picker flow, skipped players via API, "Sessions" back button
- `apps/web/src/components/draft-room/SessionPicker.tsx` — **NEW** component: lists sessions, resume/delete, create form (name, budget, teams, season)

**Database Tables Added (migration `5d751b19e16d`):**
- `draft_sessions` — id, user_id (FK→users), name, league_type, budget_total, roster_size, num_teams, season, status, created_at, updated_at
- `draft_picks` — id, session_id (FK), player_id, purchase_price, suggested_price, slot, pick_order, picked_at. Unique(session_id, player_id)
- `taken_players` — id, session_id (FK), player_id, marked_at. Unique(session_id, player_id)
- `skipped_players` — id, session_id (FK), player_id, skip_reason, recommendation_context (JSONB), skipped_at
- `session_preferences` — id, session_id (FK, unique), scoring_mode, position_filter, min/max cost/fpts, updated_at

**Not Yet Implemented (deferred):**
- "Clear skipped" API endpoint (skipped players are persisted, currently no bulk-delete endpoint)
- Session preferences are not read/written yet (table exists, UI still uses local state for filters)

---

**Previous Session (2026-02-05) - Phase 1: Google OAuth Implementation:**

Implemented Google authentication with Authorization Code Flow + PKCE.

**Backend (FastAPI):**
- `packages/api/api/auth/` module with config, jwt, oauth, dependencies
- `packages/api/api/routers/auth.py` - Auth endpoints
- `packages/core/core/db/models.py` - Added User model
- JWT tokens stored in httpOnly cookies (`sports_hub_token`)
- PKCE code verifier validation

**Frontend (React):**
- `src/contexts/AuthContext.tsx` - Auth state management
- `src/hooks/useGoogleAuth.ts` - PKCE flow (code verifier/challenge generation)
- `src/components/AuthButton.tsx` - Sign in/out button with avatar
- `src/pages/AuthCallback.tsx` - OAuth callback handler
- `src/lib/auth.ts` - API functions for auth

**Auth API Endpoints:**
```
POST /api/v1/auth/google   - Exchange code for JWT, set cookie
GET  /api/v1/auth/me       - Get current user (requires auth)
PATCH /api/v1/auth/me      - Update preferences
POST /api/v1/auth/logout   - Clear cookie
```

**Environment Variables Required:**
```bash
# Backend .env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
JWT_SECRET=<generate with: openssl rand -base64 32>

# Frontend apps/web/.env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

**Google Cloud Console Setup:**
1. Create OAuth 2.0 Client ID (Web application)
2. Authorized JavaScript origins: `http://localhost:3001`
3. Authorized redirect URIs: `http://localhost:3001/auth/callback`

**Port Configuration:** Frontend runs on port 3001 (LeetCode Spaced Rep uses port 3000).

**OAuth Bugs Fixed:**
1. Stale sessionStorage causing infinite loading spinner — AuthContext checks pathname before treating verifier as active
2. AuthCallback not cleaning sessionStorage on error paths — explicit cleanup
3. React StrictMode double-execution — `useRef` guard

---

**Previous Session (2026-02-04) - Theme System Implementation:**

Added full light/dark mode support. ThemeContext manages state, persists to localStorage. CSS variables in `index.css`. All components use semantic color tokens.

**Previous Session (2026-02-03) - Draft Room UI/UX Improvements:**

Stable prices, expandable stats, taken players panel, fixed category strength scaling, improved reinforce recs, filters/scoring modes, skip button, FPTS/$ display, simplified affordability (2-tier: affordable/stretch).

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
uv run pytest -v packages/  # Verify tests still pass (67 tests)
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
│   │       ├── real_data.py    # Load real NBA players from API
│   │       └── ml/projector.py # XGBoost (not yet wired to draft room)
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
│       │   ├── DraftRoom.tsx             # Draft assistant page (auth-gated, session picker)
│       │   ├── PlayerStats.tsx           # Player stats browser page
│       │   └── AuthCallback.tsx          # OAuth callback handler
│       ├── components/
│       │   ├── ThemeToggle.tsx           # Sun/Moon toggle button
│       │   ├── AuthButton.tsx            # Sign in/out with avatar
│       │   ├── draft-room/
│       │   │   ├── SessionPicker.tsx     # Session list + create form
│       │   │   ├── RecommendationsPanel.tsx
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
└── models/player_projector/  # Trained XGBoost model
```

## API Endpoints

### Draft Sessions (all require auth)

```bash
# Session management
GET    /api/v1/draft-sessions/              # List user's sessions
POST   /api/v1/draft-sessions/              # Create new session {name, budget, num_teams, season}
GET    /api/v1/draft-sessions/{id}          # Get session state (reconstructed from DB)
PATCH  /api/v1/draft-sessions/{id}          # Update session {name, status}
DELETE /api/v1/draft-sessions/{id}          # Delete session (cascades)

# Draft actions
POST   /api/v1/draft-sessions/{id}/draft   # Draft player {player_id, cost, slot?}
POST   /api/v1/draft-sessions/{id}/taken   # Mark taken {player_id}
POST   /api/v1/draft-sessions/{id}/skip    # Skip player {player_id, reason?}
POST   /api/v1/draft-sessions/{id}/undo    # Undo last action (DB-level timestamp comparison)

# Recommendations & search
GET    /api/v1/draft-sessions/{id}/recommendations  # Category-aware recs (skipped auto-loaded from DB)
GET    /api/v1/draft-sessions/{id}/search            # Player search by name
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
draft_state = load_draft_state(db, session_id)
# Internally: loads player pool (cached), replays picks in order, replays taken players, clears action history

# Persist mutations individually after validation
persist_draft_pick(db, session_id, player_id, price, slot, ...)
persist_taken_player(db, session_id, player_id)
persist_skipped_player(db, session_id, player_id, reason)

# Undo: compare timestamps, delete newer
undo_last_action(db, session_id)  # Returns {action_type, player_id} or None

# Player pool cache: dict[season_str, list[PlayerProjection]]
# NBA API called once per season per server lifecycle
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
3. `uv run pytest -v packages/` passes (67 tests)
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

1. **Wire up XGBoost projections** - Show predicted next-season stats instead of current season actuals
2. **Volume stats** - Add total stats (not just per-game) to better evaluate player impact
3. **Clear skipped players endpoint** - Bulk delete skipped players for a session
4. **Persist session preferences** - Read/write filter preferences from `session_preferences` table
5. **Game predictor** - Use XGBoost classifier for game outcomes
6. **LLM scouting reports** - Integrate Gemini API
7. **Real-time live drafts** - WebSocket connections, multi-user rooms

**IMPORTANT - Stats are CURRENT SEASON ACTUALS:**
The stats shown (PPG, RPG, etc.) are from the 2024-25 NBA season via NBA API, NOT XGBoost projections. The XGBoost model exists but isn't wired up yet.

## Learning Session Notes (2026-02-04)

**Architecture:** Layer 1 entry: `ingest_data.py` → `player_stats_service.py` → `data_loader.py`. Caching with `diskcache` in `data_loader.py`.

**Feature Engineering:** FG%/FT% bonuses use total made/attempted. Age adjustment only in auction value, not FPTS. FPTS = pure stats; Auction Value = FPTS + externals.

**ML:** XGBoost uses gradient boosting (sequential trees), not backprop. 9 separate models. Need min 2 seasons for training.

**Infrastructure:** Port 5001 MLflow, 5432 PostgreSQL, 8000 API, 3001 frontend.
