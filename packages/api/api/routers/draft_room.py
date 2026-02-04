"""Draft room API endpoints for live auction draft assistance."""

import contextlib
from typing import Any, Literal

from draft_optimizer import PlayerProjection, Position, RosterConfig, RosterSlot
from draft_optimizer.draft_room import (
    create_session,
    delete_session,
    get_session,
)
from draft_optimizer.mock_data import generate_mock_players
from draft_optimizer.real_data import load_real_players_from_api
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/draft-room", tags=["draft-room"])


# Request/Response Models


class CreateSessionRequest(BaseModel):
    """Request to create a new draft session."""

    players: list[PlayerProjection] | None = Field(
        default=None,
        description="Player pool with projections. If not provided, generates mock data.",
    )
    config: RosterConfig | None = Field(
        default=None,
        description="Roster config. If not provided, uses defaults.",
    )
    budget: float | None = Field(
        default=None,
        description="Shorthand for config.budget (ignored if config is provided)",
    )
    num_teams: int = Field(default=12, ge=4, le=20)
    use_mock_data: bool = Field(
        default=False,
        description="Use generated mock player data (default: False, uses real NBA data)",
    )
    use_real_data: bool = Field(
        default=True,
        description="Use real NBA API data (default: True)",
    )
    season: str = Field(
        default="2024-25",
        description="NBA season for real data (e.g., '2024-25')",
    )
    min_games: int = Field(
        default=20,
        ge=1,
        description="Minimum games played to include player (for real data)",
    )
    mock_player_count: int = Field(default=160, ge=50, le=500)


class CreateSessionResponse(BaseModel):
    """Response from session creation."""

    session_id: str
    roster_size: int
    budget: float
    num_teams: int
    player_count: int


class DraftPlayerRequest(BaseModel):
    """Request to draft a player for my team."""

    player_id: str
    cost: float = Field(ge=1.0)
    slot: str | None = Field(
        default=None,
        description="Roster slot (auto-assigns if not specified)",
    )


class DraftedPlayerResponse(BaseModel):
    """Response for a drafted player."""

    player_id: str
    name: str
    position: str
    cost: float
    slot: str


class MarkTakenRequest(BaseModel):
    """Request to mark a player as taken by another team."""

    player_id: str


class RecommendationResponse(BaseModel):
    """A pick recommendation."""

    player_id: str
    name: str
    team: str
    position: str
    projected_fpts: float
    auction_value: float
    suggested_max_bid: float
    value_vs_projection: float
    fills_slot: str
    priority_rank: int


class RosterPlayerResponse(BaseModel):
    """A player on my roster."""

    player_id: str
    name: str
    team: str
    position: str
    slot: str
    cost: float
    projected_fpts: float


class TakenPlayerResponse(BaseModel):
    """A player taken by another team."""

    player_id: str
    name: str
    team: str
    position: str
    projected_fpts: float
    auction_value: float


class DraftStateResponse(BaseModel):
    """Current draft state."""

    session_id: str
    my_roster: list[RosterPlayerResponse]
    budget_remaining: float
    budget_total: float
    roster_size: int
    roster_spots_remaining: int
    players_taken_by_others: int
    players_available: int
    slots_needed: list[str]
    taken_players: list[TakenPlayerResponse]


class PlayerSearchResponse(BaseModel):
    """Player search result."""

    player_id: str
    name: str
    team: str
    position: str
    projected_fpts: float
    auction_value: float
    is_available: bool


class CategoryAnalysisResponse(BaseModel):
    """Analysis of a single stat category."""

    category: str
    team_total: float
    league_mean: float
    league_std: float
    z_score: float
    strength: str  # "strong", "average", "weak"


class RosterCategoryAnalysisResponse(BaseModel):
    """Complete category analysis for the roster."""

    categories: list[CategoryAnalysisResponse]
    strong_categories: list[str]
    weak_categories: list[str]
    average_categories: list[str]


class CategoryAwareRecommendationResponse(BaseModel):
    """A recommendation with category-aware analysis."""

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
    affordability: str  # "affordable" or "stretch"
    category_fit_score: float
    # Individual stat projections
    points: float
    rebounds: float
    assists: float
    steals: float
    blocks: float
    turnovers: float
    fg_pct: float
    ft_pct: float
    three_made: float


class CategoryRecommendationsResponse(BaseModel):
    """Response containing category analysis and split recommendations."""

    roster_analysis: RosterCategoryAnalysisResponse
    fill_gap_recommendations: list[CategoryAwareRecommendationResponse]
    reinforce_recommendations: list[CategoryAwareRecommendationResponse]


# Endpoints


@router.post("/session/create", response_model=CreateSessionResponse)
async def create_draft_session(request: CreateSessionRequest) -> CreateSessionResponse:
    """Create a new draft session.

    Returns a session_id to use for subsequent operations.
    """
    # Build config - use provided config, or build from budget, or use defaults
    if request.config is not None:
        config = request.config
    elif request.budget is not None:
        config = RosterConfig(budget=request.budget)
    else:
        config = RosterConfig()

    # Get or generate player pool
    if request.players is not None:
        # Use explicitly provided players
        players = request.players
    elif request.use_mock_data:
        # Generate mock data
        players = generate_mock_players(
            count=request.mock_player_count,
            budget=config.budget,
            roster_size=config.roster_size,
        )
    elif request.use_real_data:
        # Load real NBA data from API
        try:
            players = load_real_players_from_api(
                season=request.season,
                min_games=request.min_games,
            )
            if not players:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to load real NBA data. Check NBA API connection.",
                )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error loading NBA data: {str(e)}",
            ) from e
    else:
        # Default to mock if nothing specified
        players = generate_mock_players(
            count=request.mock_player_count,
            budget=config.budget,
            roster_size=config.roster_size,
        )

    if len(players) < config.roster_size * request.num_teams:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least {config.roster_size * request.num_teams} players",
        )

    # Create session
    session = create_session(
        player_pool=players,
        config=config,
        num_teams=request.num_teams,
    )

    return CreateSessionResponse(
        session_id=session.session_id,
        roster_size=session.config.roster_size,
        budget=session.config.budget,
        num_teams=session.num_teams,
        player_count=len(players),
    )


@router.get("/session/{session_id}/state", response_model=DraftStateResponse)
async def get_draft_state(session_id: str) -> DraftStateResponse:
    """Get the current state of a draft session."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    roster = [
        RosterPlayerResponse(
            player_id=dp.player.id,
            name=dp.player.name,
            team=dp.player.team,
            position=dp.player.position.value if hasattr(dp.player.position, 'value') else dp.player.position,
            slot=dp.slot.value,
            cost=dp.cost,
            projected_fpts=dp.player.projected_fpts,
        )
        for dp in session.my_roster
    ]

    taken_players = [
        TakenPlayerResponse(
            player_id=p.id,
            name=p.name,
            team=p.team,
            position=p.position.value if hasattr(p.position, 'value') else p.position,
            projected_fpts=p.projected_fpts,
            auction_value=p.auction_value,
        )
        for p in session.get_taken_players()
    ]

    return DraftStateResponse(
        session_id=session.session_id,
        my_roster=roster,
        budget_remaining=session.my_budget_remaining,
        budget_total=session.config.budget,
        roster_size=session.roster_size,
        roster_spots_remaining=session.roster_spots_remaining,
        players_taken_by_others=len(session.taken_player_ids),
        players_available=len(session.available_players),
        slots_needed=[s.value for s in session._slots_needed],
        taken_players=taken_players,
    )


@router.post("/session/{session_id}/draft-for-me", response_model=DraftedPlayerResponse)
async def draft_player(
    session_id: str,
    request: DraftPlayerRequest,
) -> DraftedPlayerResponse:
    """Add a player to my roster."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    slot = RosterSlot(request.slot) if request.slot else None

    try:
        drafted = session.draft_player_for_me(
            player_id=request.player_id,
            cost=request.cost,
            slot=slot,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return DraftedPlayerResponse(
        player_id=drafted.player.id,
        name=drafted.player.name,
        position=drafted.player.position.value if hasattr(drafted.player.position, 'value') else drafted.player.position,
        cost=drafted.cost,
        slot=drafted.slot.value,
    )


@router.post("/session/{session_id}/mark-taken")
async def mark_player_taken(
    session_id: str,
    request: MarkTakenRequest,
) -> dict[str, str]:
    """Mark a player as taken by another team."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        session.mark_player_taken(request.player_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return {"status": "ok", "player_id": request.player_id}


@router.get("/session/{session_id}/recommendations", response_model=list[RecommendationResponse])
async def get_recommendations(
    session_id: str,
    top_n: int = 5,
    position: str | None = None,
) -> list[RecommendationResponse]:
    """Get top N pick recommendations."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    pos_filter = Position(position) if position else None

    recommendations = session.get_recommendations(top_n=top_n, position_filter=pos_filter)

    return [
        RecommendationResponse(
            player_id=rec.player.id,
            name=rec.player.name,
            team=rec.player.team,
            position=rec.player.position.value if hasattr(rec.player.position, 'value') else rec.player.position,
            projected_fpts=rec.player.projected_fpts,
            auction_value=rec.player.auction_value,
            suggested_max_bid=rec.suggested_max_bid,
            value_vs_projection=rec.value_vs_projection,
            fills_slot=rec.fills_slot.value,
            priority_rank=rec.priority_rank,
        )
        for rec in recommendations
    ]


@router.get("/session/{session_id}/search", response_model=list[PlayerSearchResponse])
async def search_players(
    session_id: str,
    q: str,
    limit: int = 10,
    include_taken: bool = False,
) -> list[PlayerSearchResponse]:
    """Search for players by name."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")

    players = session.search_players(query=q, limit=limit, include_taken=include_taken)

    # Determine availability
    my_ids = {dp.player.id for dp in session.my_roster}

    return [
        PlayerSearchResponse(
            player_id=p.id,
            name=p.name,
            team=p.team,
            position=p.position.value if hasattr(p.position, 'value') else p.position,
            projected_fpts=p.projected_fpts,
            auction_value=p.auction_value,
            is_available=p.id not in session.taken_player_ids and p.id not in my_ids,
        )
        for p in players
    ]


@router.get("/session/{session_id}/category-recommendations", response_model=CategoryRecommendationsResponse)
async def get_category_recommendations(
    session_id: str,
    top_n: int = 10,
    position: str | None = None,
    scoring_mode: str = "balanced",
    min_cost: float | None = None,
    max_cost: float | None = None,
    min_fpts: float | None = None,
    max_fpts: float | None = None,
    affordability: str | None = None,
    skipped_ids: str | None = None,
) -> CategoryRecommendationsResponse:
    """Get category-aware recommendations with roster analysis.

    Args:
        session_id: Draft session ID
        top_n: Number of recommendations per group
        position: Filter by position (PG, SG, SF, PF, C)
        scoring_mode: "balanced", "value", or "production"
        min_cost: Minimum auction value
        max_cost: Maximum auction value
        min_fpts: Minimum projected FPTS
        max_fpts: Maximum projected FPTS
        affordability: Comma-separated affordability tags (affordable,stretch)
        skipped_ids: Comma-separated player IDs to exclude

    Returns:
    - Roster category analysis (strong/weak/average categories)
    - Fill gap recommendations (players that help weak categories)
    - Reinforce strength recommendations (players that build on strengths)
    """
    from draft_optimizer.schemas import AffordabilityTag

    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    pos_filter = Position(position) if position else None

    # Parse scoring mode
    valid_modes = ("balanced", "value", "production")
    if scoring_mode not in valid_modes:
        scoring_mode = "balanced"

    # Parse affordability filter
    affordability_filter = None
    if affordability:
        with contextlib.suppress(ValueError):
            affordability_filter = [
                AffordabilityTag(tag.strip())
                for tag in affordability.split(",")
                if tag.strip()
            ]

    # Parse skipped IDs
    skipped_player_ids = None
    if skipped_ids:
        skipped_player_ids = {pid.strip() for pid in skipped_ids.split(",") if pid.strip()}

    roster_analysis, fill_gap_recs, reinforce_recs = session.get_category_aware_recommendations(
        top_n=top_n,
        position_filter=pos_filter,
        scoring_mode=scoring_mode,  # type: ignore[arg-type]
        min_cost=min_cost,
        max_cost=max_cost,
        min_fpts=min_fpts,
        max_fpts=max_fpts,
        affordability_filter=affordability_filter,
        skipped_player_ids=skipped_player_ids,
    )

    return CategoryRecommendationsResponse(
        roster_analysis=RosterCategoryAnalysisResponse(
            categories=[
                CategoryAnalysisResponse(
                    category=cat.category,
                    team_total=cat.team_total,
                    league_mean=cat.league_mean,
                    league_std=cat.league_std,
                    z_score=cat.z_score,
                    strength=cat.strength.value,
                )
                for cat in roster_analysis.categories
            ],
            strong_categories=roster_analysis.strong_categories,
            weak_categories=roster_analysis.weak_categories,
            average_categories=roster_analysis.average_categories,
        ),
        fill_gap_recommendations=[
            CategoryAwareRecommendationResponse(
                player_id=rec.player_id,
                name=rec.name,
                team=rec.team,
                position=rec.position,
                projected_fpts=rec.projected_fpts,
                auction_value=rec.auction_value,
                suggested_max_bid=rec.suggested_max_bid,
                fills_slot=rec.fills_slot,
                priority_rank=rec.priority_rank,
                strategy=rec.strategy,
                target_categories=rec.target_categories,
                affordability=rec.affordability.value,
                category_fit_score=rec.category_fit_score,
                points=rec.points,
                rebounds=rec.rebounds,
                assists=rec.assists,
                steals=rec.steals,
                blocks=rec.blocks,
                turnovers=rec.turnovers,
                fg_pct=rec.fg_pct,
                ft_pct=rec.ft_pct,
                three_made=rec.three_made,
            )
            for rec in fill_gap_recs
        ],
        reinforce_recommendations=[
            CategoryAwareRecommendationResponse(
                player_id=rec.player_id,
                name=rec.name,
                team=rec.team,
                position=rec.position,
                projected_fpts=rec.projected_fpts,
                auction_value=rec.auction_value,
                suggested_max_bid=rec.suggested_max_bid,
                fills_slot=rec.fills_slot,
                priority_rank=rec.priority_rank,
                strategy=rec.strategy,
                target_categories=rec.target_categories,
                affordability=rec.affordability.value,
                category_fit_score=rec.category_fit_score,
                points=rec.points,
                rebounds=rec.rebounds,
                assists=rec.assists,
                steals=rec.steals,
                blocks=rec.blocks,
                turnovers=rec.turnovers,
                fg_pct=rec.fg_pct,
                ft_pct=rec.ft_pct,
                three_made=rec.three_made,
            )
            for rec in reinforce_recs
        ],
    )


@router.post("/session/{session_id}/undo")
async def undo_last_action(session_id: str) -> dict[str, Any]:
    """Undo the last draft action."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    action = session.undo_last_action()

    if action is None:
        return {"status": "no_action", "message": "No actions to undo"}

    return {
        "status": "undone",
        "action_type": action.action_type,
        "player_id": action.player_id,
    }


@router.delete("/session/{session_id}")
async def delete_draft_session(session_id: str) -> dict[str, str]:
    """Delete a draft session."""
    if not delete_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")

    return {"status": "deleted", "session_id": session_id}
