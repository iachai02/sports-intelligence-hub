"""Public player stats browser API endpoints."""

import logging
import time
from typing import Literal

from draft_optimizer.projection_service import load_projected_players
from draft_optimizer.real_data import load_real_players_from_api
from draft_optimizer.schemas import PlayerProjection, Position
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/players", tags=["players"])
logger = logging.getLogger(__name__)

# In-memory cache for player data (1 hour TTL)
# Key format: "{season}_{view}" e.g. "2024-25_actual", "2025-26_projected"
_player_cache: dict[str, list[PlayerProjection]] = {}
_cache_timestamp: float = 0
CACHE_TTL_SECONDS = 3600  # 1 hour


def _get_cached_players(
    season: str = "2024-25", view: str = "actual"
) -> list[PlayerProjection]:
    """Get players from cache or load from API/projector."""
    global _player_cache, _cache_timestamp

    cache_key = f"{season}_{view}"
    current_time = time.time()

    # Check if cache is valid
    if cache_key in _player_cache and (current_time - _cache_timestamp) < CACHE_TTL_SECONDS:
        return _player_cache[cache_key]

    # Load fresh data
    if view == "projected":
        logger.info(f"Loading projected player data for {season} (cache miss or expired)")
        players = load_projected_players(target_season=season)
    else:
        logger.info(f"Loading player data for season {season} (cache miss or expired)")
        players = load_real_players_from_api(season=season, min_games=20)

    if not players:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load player data for {season} ({view})",
        )

    # Update cache
    _player_cache[cache_key] = players
    _cache_timestamp = current_time

    return players


# Response Models


class PlayerListItem(BaseModel):
    """Player summary for list view."""

    player_id: str
    name: str
    team: str
    position: str
    projected_fpts: float
    auction_value: float
    ppg: float
    rpg: float
    apg: float
    spg: float
    bpg: float
    topg: float
    fg_pct: float
    ft_pct: float
    three_pm: float


class PlayerListResponse(BaseModel):
    """Paginated list of players."""

    players: list[PlayerListItem]
    total: int
    page: int
    per_page: int
    total_pages: int
    season: str = "2024-25"
    view: str = "actual"


class PlayerDetail(BaseModel):
    """Full player details."""

    player_id: str
    name: str
    team: str
    position: str
    projected_fpts: float
    auction_value: float
    ppg: float
    rpg: float
    apg: float
    spg: float
    bpg: float
    topg: float
    fg_pct: float
    ft_pct: float
    three_pm: float


class PlayerSearchResult(BaseModel):
    """Player search result."""

    player_id: str
    name: str
    team: str
    position: str
    projected_fpts: float
    auction_value: float


class PlayerComparisonItem(BaseModel):
    """Player data for comparison view."""

    player_id: str
    name: str
    team: str
    position: str
    projected_fpts: float
    auction_value: float
    ppg: float
    rpg: float
    apg: float
    spg: float
    bpg: float
    topg: float
    fg_pct: float
    ft_pct: float
    three_pm: float


class ComparisonResponse(BaseModel):
    """Response for player comparison."""

    players: list[PlayerComparisonItem]


class CompareRequest(BaseModel):
    """Request body for comparing players."""

    player_ids: list[str] = Field(..., min_length=2, max_length=3)


def _player_to_list_item(player: PlayerProjection) -> PlayerListItem:
    """Convert PlayerProjection to PlayerListItem."""
    return PlayerListItem(
        player_id=player.id,
        name=player.name,
        team=player.team,
        position=player.position.value if hasattr(player.position, "value") else str(player.position),
        projected_fpts=player.projected_fpts,
        auction_value=player.auction_value,
        ppg=player.points,
        rpg=player.rebounds,
        apg=player.assists,
        spg=player.steals,
        bpg=player.blocks,
        topg=player.turnovers,
        fg_pct=player.fg_pct,
        ft_pct=player.ft_pct,
        three_pm=player.three_made,
    )


def _player_to_detail(player: PlayerProjection) -> PlayerDetail:
    """Convert PlayerProjection to PlayerDetail."""
    return PlayerDetail(
        player_id=player.id,
        name=player.name,
        team=player.team,
        position=player.position.value if hasattr(player.position, "value") else str(player.position),
        projected_fpts=player.projected_fpts,
        auction_value=player.auction_value,
        ppg=player.points,
        rpg=player.rebounds,
        apg=player.assists,
        spg=player.steals,
        bpg=player.blocks,
        topg=player.turnovers,
        fg_pct=player.fg_pct,
        ft_pct=player.ft_pct,
        three_pm=player.three_made,
    )


def _player_to_comparison_item(player: PlayerProjection) -> PlayerComparisonItem:
    """Convert PlayerProjection to PlayerComparisonItem."""
    return PlayerComparisonItem(
        player_id=player.id,
        name=player.name,
        team=player.team,
        position=player.position.value if hasattr(player.position, "value") else str(player.position),
        projected_fpts=player.projected_fpts,
        auction_value=player.auction_value,
        ppg=player.points,
        rpg=player.rebounds,
        apg=player.assists,
        spg=player.steals,
        bpg=player.blocks,
        topg=player.turnovers,
        fg_pct=player.fg_pct,
        ft_pct=player.ft_pct,
        three_pm=player.three_made,
    )


# Endpoints


@router.get("", response_model=PlayerListResponse)
async def get_players(
    page: int = Query(default=1, ge=1, description="Page number"),
    per_page: int = Query(default=50, ge=1, le=100, description="Items per page"),
    search: str | None = Query(default=None, min_length=2, description="Search by name"),
    position: str | None = Query(default=None, description="Filter by position (PG, SG, SF, PF, C)"),
    team: str | None = Query(default=None, description="Filter by team abbreviation"),
    sort_by: str = Query(default="auction_value", description="Column to sort by"),
    sort_order: Literal["asc", "desc"] = Query(default="desc", description="Sort order"),
    season: str = Query(default="2024-25", description="NBA season"),
    view: str = Query(default="actual", description="'actual' or 'projected'"),
) -> PlayerListResponse:
    """List players with pagination, filtering, and sorting."""
    players = _get_cached_players(season=season, view=view)

    # Filter by search
    if search:
        search_lower = search.lower()
        players = [p for p in players if search_lower in p.name.lower()]

    # Filter by position
    if position:
        try:
            pos_enum = Position(position.upper())
            players = [p for p in players if p.position == pos_enum]
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid position: {position}. Valid values: PG, SG, SF, PF, C",
            ) from e

    # Filter by team
    if team:
        team_upper = team.upper()
        players = [p for p in players if p.team.upper() == team_upper]

    # Sort
    sort_key_map = {
        "auction_value": lambda p: p.auction_value,
        "projected_fpts": lambda p: p.projected_fpts,
        "name": lambda p: p.name.lower(),
        "team": lambda p: p.team.lower(),
        "position": lambda p: p.position.value if hasattr(p.position, "value") else str(p.position),
        "ppg": lambda p: p.points,
        "rpg": lambda p: p.rebounds,
        "apg": lambda p: p.assists,
        "spg": lambda p: p.steals,
        "bpg": lambda p: p.blocks,
        "topg": lambda p: p.turnovers,
        "fg_pct": lambda p: p.fg_pct,
        "ft_pct": lambda p: p.ft_pct,
        "three_pm": lambda p: p.three_made,
    }

    sort_key = sort_key_map.get(sort_by, sort_key_map["auction_value"])
    reverse = sort_order == "desc"
    players = sorted(players, key=sort_key, reverse=reverse)

    # Paginate
    total = len(players)
    total_pages = (total + per_page - 1) // per_page
    start = (page - 1) * per_page
    end = start + per_page
    paginated = players[start:end]

    return PlayerListResponse(
        players=[_player_to_list_item(p) for p in paginated],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
        season=season,
        view=view,
    )


@router.get("/search", response_model=list[PlayerSearchResult])
async def search_players(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(default=10, ge=1, le=20, description="Maximum results"),
    season: str = Query(default="2024-25", description="NBA season"),
    view: str = Query(default="actual", description="'actual' or 'projected'"),
) -> list[PlayerSearchResult]:
    """Fast typeahead search for player names."""
    players = _get_cached_players(season=season, view=view)

    q_lower = q.lower()
    matches = [p for p in players if q_lower in p.name.lower()]

    # Sort by auction value (most valuable first) and limit
    matches.sort(key=lambda p: -p.auction_value)
    matches = matches[:limit]

    return [
        PlayerSearchResult(
            player_id=p.id,
            name=p.name,
            team=p.team,
            position=p.position.value if hasattr(p.position, "value") else str(p.position),
            projected_fpts=p.projected_fpts,
            auction_value=p.auction_value,
        )
        for p in matches
    ]


@router.get("/teams", response_model=list[str])
async def get_teams(
    season: str = Query(default="2024-25", description="NBA season"),
    view: str = Query(default="actual", description="'actual' or 'projected'"),
) -> list[str]:
    """Get list of all teams for dropdown."""
    players = _get_cached_players(season=season, view=view)

    teams = sorted(set(p.team for p in players))
    return teams


@router.get("/{player_id}", response_model=PlayerDetail)
async def get_player(
    player_id: str,
    season: str = Query(default="2024-25", description="NBA season"),
    view: str = Query(default="actual", description="'actual' or 'projected'"),
) -> PlayerDetail:
    """Get full details for a specific player."""
    players = _get_cached_players(season=season, view=view)

    for player in players:
        if player.id == player_id:
            return _player_to_detail(player)

    raise HTTPException(status_code=404, detail=f"Player not found: {player_id}")


@router.post("/compare", response_model=ComparisonResponse)
async def compare_players(
    request: CompareRequest,
    season: str = Query(default="2024-25", description="NBA season"),
    view: str = Query(default="actual", description="'actual' or 'projected'"),
) -> ComparisonResponse:
    """Compare 2-3 players side by side."""
    players = _get_cached_players(season=season, view=view)

    # Build lookup
    player_map = {p.id: p for p in players}

    # Find requested players
    comparison_players = []
    not_found = []

    for pid in request.player_ids:
        if pid in player_map:
            comparison_players.append(player_map[pid])
        else:
            not_found.append(pid)

    if not_found:
        raise HTTPException(
            status_code=404,
            detail=f"Players not found: {', '.join(not_found)}",
        )

    return ComparisonResponse(
        players=[_player_to_comparison_item(p) for p in comparison_players]
    )
