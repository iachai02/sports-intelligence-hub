# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sports Intelligence Hub - an ML platform for NBA game predictions and fantasy draft optimization. Built as a recruiter demo showcasing end-to-end ML engineering. See `prd.md` for full requirements.

**Key Technologies:** Python 3.11+, FastAPI, PostgreSQL, SQLAlchemy, PuLP (LP optimization), XGBoost, MLflow, React, uv (package manager)

**Monorepo Structure:** Three packages in `packages/` + React frontend in `apps/web/`

## Current Status: Theme System & Dark Mode Complete ✅

**Completed Features:**
- ✅ Real NBA API integration (free, via `nba_api` library)
- ✅ Auction value calculation with age, games played, and volume adjustments
- ✅ XGBoost projection model trained on 3 seasons of real data
- ✅ Draft Room API with real player data (correct teams, realistic values)
- ✅ Category-Aware Recommendations with filters and scoring modes
- ✅ Search Typeahead with 300ms debounce and request cancellation
- ✅ Taken Players Panel
- ✅ Expandable player stats (9-cat grid)
- ✅ Skip button for recommendations
- ✅ **Light/Dark Theme Toggle** with localStorage persistence
- ✅ 47 tests passing (core + optimizer)

**Most Recent Session (2026-02-04) - Theme System Implementation:**

Added full light/dark mode support across the entire app:

1. **Theme Context** (`src/contexts/ThemeContext.tsx`):
   - Manages `light`/`dark` state
   - Persists to localStorage (`sports-hub-theme` key)
   - Applies `.dark` class to `<html>` element
   - Defaults to dark mode

2. **Theme Toggle** (`src/components/ThemeToggle.tsx`):
   - Sun/Moon icon button
   - Appears in header of every page

3. **CSS Variables** (`src/index.css`):
   - Light theme: white backgrounds, dark text
   - Dark theme: grayish (not pure black) backgrounds
   - Semantic tokens: `--background`, `--foreground`, `--card`, `--muted`, `--accent`, `--border`, `--input`

4. **Dark Theme Colors** (HSL values):
   - Background: `220 13% 13%` (~#1e2127, dark blue-gray)
   - Card: `220 13% 16%` (~#262a31)
   - Input: `220 13% 18%` (form elements)
   - Muted: `220 12% 20%` (~#2d323a)
   - Border: `220 12% 24%` (~#363c46)
   - Muted-foreground: `215 16% 60%`

5. **All components updated** to use semantic color tokens:
   - `text-foreground`, `text-muted-foreground`
   - `bg-background`, `bg-card`, `bg-muted`, `bg-input`
   - `border-border`
   - `text-accent`, `bg-accent`
   - `text-stat-positive`, `text-stat-negative`

**Files Changed:**
- `src/contexts/ThemeContext.tsx` (NEW)
- `src/components/ThemeToggle.tsx` (NEW)
- `src/index.css` (theme variables)
- `tailwind.config.js` (added `input` color)
- `src/App.tsx` (ThemeProvider wrapper, semantic colors)
- All page components (DraftRoom, PlayerStats)
- All draft-room components (BudgetTracker, MyRoster, RecommendationsPanel, PlayerSearch, TakenPlayersPanel)
- All player-stats components (PlayerStatsTable, PlayerStatsFilters, PlayerDetailModal, PlayerComparisonView)
- Optimizer components (DraftOptimizer, OptimizeButton, BudgetSummary, RosterTable)

**Previous Session (2026-02-03) - Simplified Affordability Filter:**

Removed "unlikely" affordability tag. Now two-tier system:
- **Affordable**: ≤40% of remaining budget
- **Stretch**: >40% of remaining budget

Files changed: `schemas.py`, `draft_room.py`, `draft_room.py` (API), `types.ts`, `RecommendationsPanel.tsx`

**Previous Session (2026-02-03) - Draft Room UI/UX Improvements:**

1. **Stable Prices (Issue 3)**: Use original `player.auction_value` instead of recalculating. Giannis now shows ~$74 even after drafting other stars.

2. **Show Player Stats (Issue 1)**: Added expandable 9-stat grid to recommendation cards. Click "Show Stats" to see PPG, RPG, APG, SPG, BPG, TOV, FG%, FT%, 3PM.

3. **Taken Players Panel (Issue 4)**: New collapsible panel in left column showing all players marked as taken by other teams.

4. **Fixed Category Strength Analysis (Issue 2)**: League averages now scale by roster progress. With 2/13 slots filled, scaled_mean = full_mean * (2/13), scaled_std = full_std * sqrt(2/13). Jokic + Wemby now shows as STRONG in PPG/RPG instead of weak.

5. **Improved Reinforce Recommendations (Issue 5)**: Fixed algorithm so reinforce tab actually shows players:
   - Changed early draft threshold from `roster_size <= 2` to `roster_size == 0`
   - Now creates TWO recs per player (one fill_gap, one reinforce)
   - Equal weighting (100 pts each) instead of half-weight for reinforce
   - Loosened "excels in" threshold from top 25% to top 30%

6. **Added Filters & Scoring Modes**:
   - Position filter (All/PG/SG/SF/PF/C)
   - Cost range (min/max auction value)
   - FPTS range (min/max projected fantasy points)
   - Affordability checkboxes (Affordable/Stretch)
   - Scoring mode toggle: Balanced/Value/Production

7. **Skip Button**: Click X on recommendation to hide player for this session. "Clear N skipped" button to restore.

8. **FPTS/$ Display**: Each recommendation card now shows FPTS per dollar efficiency.

**IMPORTANT - Stats are CURRENT SEASON ACTUALS:**
The stats shown (PPG, RPG, etc.) are from the 2024-25 NBA season via NBA API, NOT XGBoost projections. The XGBoost model exists but isn't wired up yet for next-season predictions.

**Next Steps:**
- Wire up XGBoost projector to show predicted next-season stats
- Game predictor feature
- LLM integration for scouting reports

## Commands

```bash
# First time setup
make install              # Install all dependencies (creates .venv)
make docker-up            # Start PostgreSQL + MLflow
brew install libomp       # Required for XGBoost on macOS

# Development
make dev                  # Run API at localhost:8000
make test                 # Run all tests
make lint                 # Run ruff + mypy

# Web app
cd apps/web && npm install
cd apps/web && npm run dev   # Run React app at localhost:3000

# Data ingestion (fetch real NBA stats)
uv run python -m core.cli.ingest_data --seasons 2024-25

# Docker
make docker-down          # Stop containers
```

## Development Workflow

**IMPORTANT: Always run `make lint` after making code changes.**

```bash
make lint                 # Must pass before committing
make test                 # Verify tests still pass
cd apps/web && npm run build  # Check TypeScript compiles
```

## Project Structure

```
sports-intelligence-hub/
├── packages/
│   ├── core/                   # Shared library
│   │   └── core/services/player_stats_service.py  # NBA data fetching
│   ├── draft-optimizer/        # Fantasy draft optimization + ML
│   │   └── draft_optimizer/
│   │       ├── schemas.py      # CategoryAwareRecommendation (includes 9 stat fields)
│   │       ├── features.py     # Fantasy scoring, auction values
│   │       ├── draft_room.py   # DraftState + get_category_aware_recommendations()
│   │       ├── real_data.py    # Load real NBA players from API
│   │       └── ml/projector.py # XGBoost (not yet wired to draft room)
│   └── api/
│       └── api/routers/draft_room.py  # API endpoints with filter params
├── apps/web/
│   └── src/
│       ├── contexts/
│       │   └── ThemeContext.tsx          # Light/dark theme state + localStorage
│       ├── pages/
│       │   ├── DraftRoom.tsx             # Draft assistant page
│       │   └── PlayerStats.tsx           # Player stats browser page
│       ├── components/
│       │   ├── ThemeToggle.tsx           # Sun/Moon toggle button
│       │   ├── draft-room/
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
│       │   ├── api.ts
│       │   ├── types.ts
│       │   └── utils.ts
│       ├── index.css                     # Theme CSS variables (light/dark)
│       └── tailwind.config.js            # Semantic color tokens
└── models/player_projector/  # Trained XGBoost model
```

## API Endpoints

### Category Recommendations (with filters)

```bash
GET /api/v1/draft-room/session/{id}/category-recommendations
  ?top_n=10
  &position=PG                    # Filter by position
  &scoring_mode=balanced          # balanced | value | production
  &min_cost=5                     # Min auction value
  &max_cost=50                    # Max auction value
  &min_fpts=20                    # Min projected FPTS
  &max_fpts=60                    # Max projected FPTS
  &affordability=affordable,stretch  # Comma-separated tags
  &skipped_ids=nba_123,nba_456   # Comma-separated player IDs to exclude
```

**Scoring Modes:**
- `balanced`: 25% category fit, 25% FPTS, 25% value, 25% FPTS/dollar
- `value`: 20% fit, 20% FPTS, 20% value, 40% FPTS/dollar
- `production`: 20% fit, 40% FPTS, 20% value, 20% FPTS/dollar

### Draft State (includes taken players)

```bash
GET /api/v1/draft-room/session/{id}/state

# Response includes:
{
  "my_roster": [...],
  "taken_players": [           # NEW
    {"player_id": "nba_123", "name": "...", "team": "...", "position": "...", "projected_fpts": 45.2, "auction_value": 60}
  ],
  ...
}
```

## Key Implementation Details

### Category-Aware Recommendations Algorithm (draft_room.py)

**Roster Strength with Scaling:**
```python
# League averages scale by roster progress
filled_slots = len(my_roster)
if filled_slots > 0:
    scaled_mean = full_mean * (filled_slots / roster_size)
    scaled_std = full_std * math.sqrt(filled_slots / roster_size)

# Z-score calculation
z_score = (team_total - scaled_mean) / scaled_std
# > 1.0 = strong, < -1.0 = weak, else average
```

**Player Classification (creates BOTH recs per player):**
```python
def _calculate_player_category_fit(player, roster_analysis):
    # Returns: (gap_score, reinforce_score, gap_cats, reinforce_cats)
    # Player excels if in top 30% for a category
    # Both fill_gap AND reinforce recs created for each player
    # Each list sorted by its respective composite score
```

**Composite Scoring:**
```python
composite = (
    category_fit_score * w["fit"]        # How well fits roster needs
    + fpts_norm * w["fpts"]              # Raw production
    + value_norm * w["value"]            # Auction value (valuable = good)
    + fpts_per_dollar_norm * w["fpts_per_dollar"]  # Efficiency
)
```

**Early Draft Mode:**
- Only triggers with `roster_size == 0` (empty roster)
- Shows best FPTS players regardless of category fit
- Once ANY player drafted, full category analysis kicks in

**Affordability Tags** (two-tier system):
- `affordable`: ≤40% of remaining budget
- `stretch`: >40% of remaining budget

**Scoring Mode Weights:**
| Mode | Fit | FPTS | Value | FPTS/$ |
|------|-----|------|-------|--------|
| balanced | 25% | 25% | 25% | 25% |
| value | 20% | 20% | 20% | 40% |
| production | 20% | 40% | 20% | 20% |

### CategoryAwareRecommendation Schema

```python
# packages/draft-optimizer/draft_optimizer/schemas.py
class CategoryAwareRecommendation(BaseModel):
    player_id: str
    name: str
    team: str
    position: str
    projected_fpts: float
    auction_value: float
    suggested_max_bid: float
    fills_slot: str
    priority_rank: int
    strategy: Literal["fill_gap", "reinforce_strength"]
    target_categories: list[str]
    affordability: AffordabilityTag
    category_fit_score: float
    # 9 individual stats (NEW)
    points: float
    rebounds: float
    assists: float
    steals: float
    blocks: float
    turnovers: float
    fg_pct: float
    ft_pct: float
    three_made: float
```

### Frontend State Management (DraftRoom.tsx)

```typescript
// Filter state
const [filters, setFilters] = useState<RecommendationFilters>({
  scoringMode: 'balanced',
  affordability: [],
});

// Skip state (session-only, clears on refresh)
const [skippedPlayerIds, setSkippedPlayerIds] = useState<Set<string>>(new Set());

// All passed to getCategoryRecommendations() API call
```

### TakenPlayersPanel Component

```typescript
// apps/web/src/components/draft-room/TakenPlayersPanel.tsx
// Collapsible panel showing players marked as taken
// Table with: Name, Team, Position, FPTS, Value
// Max-height with scroll for long lists
```

## Testing Verification

After changes, verify:
1. `make lint` passes
2. `make test` passes (47 tests)
3. `cd apps/web && npm run build` compiles

Manual testing:
1. Start API: `make dev`
2. Start web: `cd apps/web && npm run dev`
3. Create new draft session
4. Draft Jokic (~$75)
5. Verify:
   - Category strength bar shows reasonable strengths
   - **Fill Gaps** tab shows valuable players (not just $1 specialists)
   - **Reinforce** tab now shows players (was always empty before)
   - Click "Show Stats" → see 9-stat grid
   - Mark a player as "Taken" → see in Taken Players panel
   - Try filters (position, cost range, etc.)
   - Skip a player → disappears, "Clear N skipped" appears

## Common Issues

**Reinforce tab always empty:** Fixed. Was using `roster_size <= 2` threshold. Now uses `== 0`.

**Fill Gaps showing $1 players:** Fixed. Now uses composite scoring that balances category fit with FPTS, value, and efficiency.

**Category strengths all "weak" early draft:** Fixed. League averages now scale by roster progress.

**Stats not showing:** Make sure CategoryAwareRecommendation includes the 9 stat fields in schemas.py, draft_room.py router, and types.ts.

**Dark mode not applying to form elements:** Global CSS rules in `index.css` handle native form elements. Use `bg-input` class for custom input styling.

**Theme not persisting:** Check localStorage key `sports-hub-theme`. ThemeContext applies `.dark` class to `document.documentElement`.

## Theme System Reference

**Using semantic colors in components:**
```tsx
// Backgrounds
className="bg-background"     // Page background
className="bg-card"           // Cards, panels, modals
className="bg-muted"          // Subtle backgrounds, hover states
className="bg-input"          // Form inputs (search, select, etc.)

// Text
className="text-foreground"         // Primary text
className="text-muted-foreground"   // Secondary text, labels
className="text-accent"             // Links, emphasis

// Borders
className="border-border"     // Standard borders

// Status colors
className="text-stat-positive"  // Green (success, gains)
className="text-stat-negative"  // Red (errors, losses)
```

**Adding theme toggle to a page:**
```tsx
import { ThemeToggle } from '../components/ThemeToggle';

// In JSX, typically in header:
<div className="flex justify-between">
  <h1>Page Title</h1>
  <ThemeToggle />
</div>
```

## Future Work

1. **Wire up XGBoost projections** - Show predicted next-season stats instead of current season actuals

2. **Volume stats** - Add total stats (not just per-game) to better evaluate player impact

3. ~~**Persist draft sessions**~~ - See "Next Implementation" below

4. **Game predictor** - Use XGBoost classifier for game outcomes

5. **LLM scouting reports** - Integrate Gemini API

---

## Next Implementation: OAuth + Session Persistence

**Status:** PLANNED - Ready to implement

**Implementation Order:**
1. Phase 1: Google OAuth with FastAPI
2. Phase 2: Persist Draft Sessions to PostgreSQL

### Technical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| OAuth Provider | Google only (for now) | Most users have Google accounts; add GitHub later |
| Auth Architecture | FastAPI backend | Full control, no external dependency, aligns with AWS learning goal |
| User Profile | Extended | Email, name, avatar, preferences (theme, filters, notifications) |
| Session Storage | PostgreSQL | Server-side persistence, survives browser clears, cross-device |
| User Identity | Requires OAuth | No anonymous sessions; implement OAuth first |
| Multi-session | Yes | Users can have multiple drafts (different leagues); future: real-time live drafts |
| Data Capture | Comprehensive | Capture purchase prices, skip reasons for model improvement |

### Phase 1: Google OAuth with FastAPI

**Database Schema (new tables):**

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    avatar_url TEXT,
    oauth_provider VARCHAR(20) NOT NULL DEFAULT 'google',
    oauth_id VARCHAR(100) NOT NULL,
    preferences JSONB DEFAULT '{}',  -- theme, default filters, notifications
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    UNIQUE(oauth_provider, oauth_id)
);
```

**Backend Endpoints (FastAPI):**

```
POST /api/v1/auth/google      - Exchange Google auth code for JWT
GET  /api/v1/auth/me          - Get current user profile
PATCH /api/v1/auth/me         - Update user preferences
POST /api/v1/auth/logout      - Invalidate session
```

**Security:**
- JWT tokens stored in httpOnly cookies (secure, not accessible to JS)
- CSRF protection for state-changing requests
- Token refresh mechanism

**Frontend:**
- Google Sign-In button using `@react-oauth/google`
- AuthContext for managing logged-in state
- Protected routes requiring authentication

**Files to Create/Modify:**

```
packages/api/api/
├── auth/
│   ├── __init__.py
│   ├── oauth.py          # Google OAuth logic
│   ├── jwt.py            # Token generation/validation
│   └── dependencies.py   # get_current_user dependency
├── routers/
│   └── auth.py           # Auth endpoints
└── main.py               # Add auth router

packages/core/core/
└── db/
    └── models.py         # Add User model

apps/web/src/
├── contexts/
│   └── AuthContext.tsx   # Auth state management
├── components/
│   └── AuthButton.tsx    # Google sign-in button
├── hooks/
│   └── useAuth.ts        # Auth utilities
└── lib/
    └── auth.ts           # Auth API calls
```

### Phase 2: Persist Draft Sessions

**Database Schema:**

```sql
-- Draft sessions (one per user per league)
CREATE TABLE draft_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100),                    -- "Yahoo League 2026"
    league_type VARCHAR(20) DEFAULT '9cat', -- 9cat, points, etc.
    budget_total INTEGER DEFAULT 200,
    roster_size INTEGER DEFAULT 13,
    status VARCHAR(20) DEFAULT 'active',  -- active, completed, archived
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Players drafted to my team
CREATE TABLE draft_picks (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES draft_sessions(id) ON DELETE CASCADE,
    player_id VARCHAR(50) NOT NULL,       -- nba_api player ID
    purchase_price INTEGER NOT NULL,      -- What user actually paid
    suggested_price INTEGER,              -- What model suggested (for analytics)
    pick_order INTEGER,                   -- Order drafted (1st, 2nd, etc.)
    picked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, player_id)
);

-- Players taken by other teams
CREATE TABLE taken_players (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES draft_sessions(id) ON DELETE CASCADE,
    player_id VARCHAR(50) NOT NULL,
    marked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, player_id)
);

-- Skipped players (for model improvement)
CREATE TABLE skipped_players (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES draft_sessions(id) ON DELETE CASCADE,
    player_id VARCHAR(50) NOT NULL,
    skip_reason VARCHAR(50),              -- "too_expensive", "wrong_position", "injury_concern", etc.
    recommendation_context JSONB,         -- What was shown when they skipped
    skipped_at TIMESTAMP DEFAULT NOW()
);

-- User filter preferences per session
CREATE TABLE session_preferences (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES draft_sessions(id) ON DELETE CASCADE,
    scoring_mode VARCHAR(20) DEFAULT 'balanced',
    position_filter VARCHAR(10),
    min_cost INTEGER,
    max_cost INTEGER,
    min_fpts FLOAT,
    max_fpts FLOAT,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id)
);
```

**API Endpoints:**

```
# Session management
GET    /api/v1/draft-sessions              - List user's sessions
POST   /api/v1/draft-sessions              - Create new session
GET    /api/v1/draft-sessions/{id}         - Get session details
PATCH  /api/v1/draft-sessions/{id}         - Update session (name, status)
DELETE /api/v1/draft-sessions/{id}         - Delete session

# Draft actions (existing endpoints, now persisted)
POST   /api/v1/draft-sessions/{id}/draft   - Draft a player (persisted)
POST   /api/v1/draft-sessions/{id}/taken   - Mark player taken (persisted)
POST   /api/v1/draft-sessions/{id}/skip    - Skip player with reason (persisted)
DELETE /api/v1/draft-sessions/{id}/picks/{player_id}  - Undo draft pick
```

**Analytics Data Captured:**

| Data Point | Purpose |
|------------|---------|
| `purchase_price` vs `suggested_price` | Measure model accuracy, value perception |
| `skip_reason` | Understand why users reject recommendations |
| `pick_order` | Draft position tendencies |
| `recommendation_context` | What was shown when user made decision |
| Filter preferences | Default settings, popular configurations |

**Future: Real-Time Live Drafts**

The multi-session architecture supports future real-time drafts:
- WebSocket connections for live updates
- Session becomes a "room" multiple users join
- Turn-based or auction-style bidding
- Live player availability sync across all participants

## Learning Session Notes (2026-02-04)

The user completed a comprehensive walkthrough of all 9 layers with quizzes for each. Key clarifications made:

**Architecture Understanding:**
- Layer 1 entry point is `ingest_data.py` (CLI) → calls `player_stats_service.py` → calls `data_loader.py` (lowest level)
- Caching with `diskcache` happens in `data_loader.py`, not the service layer
- ORM relationships navigate between objects (`stats.player.name`), foreign keys are the actual database column links

**Feature Engineering Clarifications:**
- FG%/FT% bonuses use "total made over total attempted" (not percentage)
- Age adjustment is only in auction value calculation, NOT in fantasy points (FPTS)
- FPTS = pure statistical calculation; Auction Value = FPTS + external factors (age, games played, position scarcity)

**ML Model Understanding:**
- XGBoost uses **gradient boosting** (sequential trees correcting errors), NOT backpropagation
- `trajectory_ppg` = `prev_ppg - prev2_ppg` (historical fact, not a prediction)
- Need minimum 2 seasons: N-1 as features, N as target (feature vs target requirement)
- 9 separate XGBoost models (one per stat category) for independent tuning

**Infrastructure:**
- Port 5001 for MLflow (not 5000) due to macOS AirPlay conflict
- PostgreSQL uses standard port 5432
- Docker Compose for local dev; AWS deployment uses separate configs
