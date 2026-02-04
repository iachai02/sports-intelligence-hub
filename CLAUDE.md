# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sports Intelligence Hub - an ML platform for NBA game predictions and fantasy draft optimization. Built as a recruiter demo showcasing end-to-end ML engineering. See `prd.md` for full requirements.

**Key Technologies:** Python 3.11+, FastAPI, PostgreSQL, SQLAlchemy, PuLP (LP optimization), XGBoost, MLflow, React, uv (package manager)

**Monorepo Structure:** Three packages in `packages/` + React frontend in `apps/web/`

## Current Status: Draft Room UI/UX Improvements Complete ✅

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
- ✅ 36 optimizer tests passing

**Most Recent Session (2026-02-03) - Draft Room UI/UX Improvements:**

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
│       ├── pages/DraftRoom.tsx           # Main page, manages filter/skip state
│       ├── components/draft-room/
│       │   ├── RecommendationsPanel.tsx  # Filters, scoring mode, skip, stats grid
│       │   ├── TakenPlayersPanel.tsx     # NEW: collapsible taken players list
│       │   ├── PlayerSearch.tsx
│       │   ├── MyRoster.tsx
│       │   └── BudgetTracker.tsx
│       └── lib/
│           ├── api.ts      # getCategoryRecommendations() with filter params
│           └── types.ts    # CategoryAwareRecommendation (includes 9 stats)
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
2. `make test` passes (36 optimizer tests)
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

## Future Work

1. **Wire up XGBoost projections** - Show predicted next-season stats instead of current season actuals

2. **Volume stats** - Add total stats (not just per-game) to better evaluate player impact

3. **Persist draft sessions** - Currently in-memory only

4. **Game predictor** - Use XGBoost classifier for game outcomes

5. **LLM scouting reports** - Integrate Gemini API
