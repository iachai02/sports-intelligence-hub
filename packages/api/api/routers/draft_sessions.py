"""Draft sessions API endpoints with database persistence."""

import contextlib
from typing import Annotated, Any, Literal

from core.db.connection import get_session
from core.db.models import DraftSession, RoomMember, User
from draft_optimizer.schemas import AffordabilityTag, Position, RosterSlot
from draft_optimizer.session_persistence import (
    create_db_session,
    delete_db_session,
    get_db_session_record,
    get_member_for_user,
    get_pick_count,
    get_room_board_state,
    get_skipped_player_ids,
    list_user_sessions,
    load_draft_state,
    load_room_draft_state,
    persist_draft_pick,
    persist_reported_pick,
    persist_skipped_player,
    persist_taken_player,
    undo_last_action,
    undo_room_last_pick,
)
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth.dependencies import get_current_user
from api.websocket import manager

router = APIRouter(prefix="/api/v1/draft-sessions", tags=["draft-sessions"])


# --- Request/Response Models ---


class CreateSessionRequest(BaseModel):
    """Request to create a new draft session."""

    name: str = Field(default="Draft Session", max_length=100)
    budget: int = Field(default=200, ge=50, le=1000)
    num_teams: int = Field(default=12, ge=4, le=20)
    season: str = Field(default="2024-25")


class CreateSessionResponse(BaseModel):
    """Response from session creation."""

    session_id: int
    name: str
    roster_size: int
    budget: int
    num_teams: int
    player_count: int


class SessionListItem(BaseModel):
    """Summary of a draft session for listing."""

    id: int
    name: str
    status: str
    budget_total: int
    num_teams: int
    season: str
    pick_count: int
    created_at: str
    updated_at: str


class UpdateSessionRequest(BaseModel):
    """Request to update session metadata."""

    name: str | None = None
    status: str | None = None


class DraftPlayerRequest(BaseModel):
    """Request to draft a player."""

    player_id: str
    cost: float = Field(ge=1.0)
    slot: str | None = None


class MarkTakenRequest(BaseModel):
    """Request to mark a player as taken."""

    player_id: str


class SkipPlayerRequest(BaseModel):
    """Request to skip a player."""

    player_id: str
    reason: str | None = None


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

    session_id: int
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
    strength: str


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
    affordability: str
    category_fit_score: float
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


# --- Helper ---


def _get_owned_session(session_id: int, user: User) -> DraftSession:
    """Get a session that belongs to the user, or raise 404."""
    db = get_session()
    try:
        db_session = get_db_session_record(db, session_id, user_id=user.id)
    finally:
        db.close()

    if db_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return db_session


# --- Endpoints ---


@router.get("/", response_model=list[SessionListItem])
async def list_sessions(
    user: Annotated[User, Depends(get_current_user)],
) -> list[SessionListItem]:
    """List all draft sessions for the current user."""
    db = get_session()
    try:
        sessions = list_user_sessions(db, user.id)
        result = []
        for s in sessions:
            count = get_pick_count(db, s.id)
            result.append(
                SessionListItem(
                    id=s.id,
                    name=s.name,
                    status=s.status,
                    budget_total=s.budget_total,
                    num_teams=s.num_teams,
                    season=s.season,
                    pick_count=count,
                    created_at=s.created_at.isoformat(),
                    updated_at=s.updated_at.isoformat(),
                )
            )
        return result
    finally:
        db.close()


@router.post("/", response_model=CreateSessionResponse)
async def create_session(
    request: CreateSessionRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> CreateSessionResponse:
    """Create a new draft session."""
    db = get_session()
    try:
        db_session, draft_state = create_db_session(
            db=db,
            user_id=user.id,
            name=request.name,
            budget=request.budget,
            num_teams=request.num_teams,
            season=request.season,
        )
        return CreateSessionResponse(
            session_id=db_session.id,
            name=db_session.name,
            roster_size=db_session.roster_size,
            budget=db_session.budget_total,
            num_teams=db_session.num_teams,
            player_count=len(draft_state._player_pool),
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        db.close()


@router.get("/{session_id}", response_model=DraftStateResponse)
async def get_session_state(
    session_id: int,
    user: Annotated[User, Depends(get_current_user)],
    view: str = "actual",
) -> DraftStateResponse:
    """Get the current state of a draft session (reconstructed from DB)."""
    _get_owned_session(session_id, user)

    db = get_session()
    try:
        draft_state = load_draft_state(db, session_id, view=view)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    finally:
        db.close()

    roster = [
        RosterPlayerResponse(
            player_id=dp.player.id,
            name=dp.player.name,
            team=dp.player.team,
            position=dp.player.position.value if hasattr(dp.player.position, "value") else dp.player.position,
            slot=dp.slot.value,
            cost=dp.cost,
            projected_fpts=dp.player.projected_fpts,
        )
        for dp in draft_state.my_roster
    ]

    taken_players = [
        TakenPlayerResponse(
            player_id=p.id,
            name=p.name,
            team=p.team,
            position=p.position.value if hasattr(p.position, "value") else p.position,
            projected_fpts=p.projected_fpts,
            auction_value=p.auction_value,
        )
        for p in draft_state.get_taken_players()
    ]

    return DraftStateResponse(
        session_id=session_id,
        my_roster=roster,
        budget_remaining=draft_state.my_budget_remaining,
        budget_total=draft_state.config.budget,
        roster_size=draft_state.roster_size,
        roster_spots_remaining=draft_state.roster_spots_remaining,
        players_taken_by_others=len(draft_state.taken_player_ids),
        players_available=len(draft_state.available_players),
        slots_needed=[s.value for s in draft_state._slots_needed],
        taken_players=taken_players,
    )


@router.patch("/{session_id}")
async def update_session(
    session_id: int,
    request: UpdateSessionRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    """Update session metadata (name, status)."""
    _get_owned_session(session_id, user)

    db = get_session()
    try:
        db_session = db.get(DraftSession, session_id)
        if db_session is None:
            raise HTTPException(status_code=404, detail="Session not found")
        if request.name is not None:
            db_session.name = request.name
        if request.status is not None:
            if request.status not in ("active", "completed", "archived"):
                raise HTTPException(status_code=400, detail="Invalid status")
            db_session.status = request.status
        db.commit()
        return {"status": "updated", "session_id": session_id}
    finally:
        db.close()


@router.delete("/{session_id}")
async def delete_session(
    session_id: int,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    """Delete a draft session (cascades to all related data)."""
    _get_owned_session(session_id, user)

    db = get_session()
    try:
        if not delete_db_session(db, session_id):
            raise HTTPException(status_code=404, detail="Session not found")
        return {"status": "deleted", "session_id": session_id}
    finally:
        db.close()


@router.post("/{session_id}/draft")
async def draft_player(
    session_id: int,
    request: DraftPlayerRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    """Draft a player to my team (persisted to DB)."""
    _get_owned_session(session_id, user)

    db = get_session()
    try:
        # Reconstruct state to validate the pick
        draft_state = load_draft_state(db, session_id)

        slot_enum = RosterSlot(request.slot) if request.slot else None
        try:
            drafted = draft_state.draft_player_for_me(
                player_id=request.player_id,
                cost=request.cost,
                slot=slot_enum,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        # Persist the pick
        persist_draft_pick(
            db=db,
            session_id=session_id,
            player_id=request.player_id,
            price=request.cost,
            slot=drafted.slot.value,
            suggested_price=drafted.player.auction_value,
        )

        return {
            "status": "drafted",
            "player_id": drafted.player.id,
            "name": drafted.player.name,
            "slot": drafted.slot.value,
            "cost": drafted.cost,
        }
    finally:
        db.close()


@router.post("/{session_id}/taken")
async def mark_taken(
    session_id: int,
    request: MarkTakenRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    """Mark a player as taken by another team (persisted to DB)."""
    _get_owned_session(session_id, user)

    db = get_session()
    try:
        # Validate via DraftState
        draft_state = load_draft_state(db, session_id)
        try:
            draft_state.mark_player_taken(request.player_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        persist_taken_player(db, session_id, request.player_id)

        return {"status": "ok", "player_id": request.player_id}
    finally:
        db.close()


@router.post("/{session_id}/skip")
async def skip_player(
    session_id: int,
    request: SkipPlayerRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    """Skip a player (persisted to DB for analytics)."""
    _get_owned_session(session_id, user)

    db = get_session()
    try:
        persist_skipped_player(db, session_id, request.player_id, request.reason)
        return {"status": "skipped", "player_id": request.player_id}
    finally:
        db.close()


@router.post("/{session_id}/undo")
async def undo_action(
    session_id: int,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    """Undo the last draft action (DB-level)."""
    _get_owned_session(session_id, user)

    db = get_session()
    try:
        result = undo_last_action(db, session_id)
        if result is None:
            return {"status": "no_action", "message": "No actions to undo"}
        return {"status": "undone", **result}
    finally:
        db.close()


@router.get("/{session_id}/recommendations", response_model=CategoryRecommendationsResponse)
async def get_recommendations(
    session_id: int,
    user: Annotated[User, Depends(get_current_user)],
    top_n: int = 10,
    position: str | None = None,
    scoring_mode: str = "balanced",
    min_cost: float | None = None,
    max_cost: float | None = None,
    min_fpts: float | None = None,
    max_fpts: float | None = None,
    affordability: str | None = None,
    skipped_ids: str | None = None,
    view: str = "actual",
) -> CategoryRecommendationsResponse:
    """Get category-aware recommendations with filters.

    Skipped players are auto-loaded from DB and merged with any
    explicitly passed skipped_ids.
    """
    _get_owned_session(session_id, user)

    db = get_session()
    try:
        draft_state = load_draft_state(db, session_id, view=view)

        # Load skipped IDs from DB
        db_skipped = get_skipped_player_ids(db, session_id)
    finally:
        db.close()

    pos_filter = Position(position) if position else None

    valid_modes = ("balanced", "value", "production")
    if scoring_mode not in valid_modes:
        scoring_mode = "balanced"

    affordability_filter = None
    if affordability:
        with contextlib.suppress(ValueError):
            affordability_filter = [
                AffordabilityTag(tag.strip())
                for tag in affordability.split(",")
                if tag.strip()
            ]

    # Merge DB skipped with any explicit skipped IDs
    skipped_player_ids = set(db_skipped)
    if skipped_ids:
        skipped_player_ids |= {pid.strip() for pid in skipped_ids.split(",") if pid.strip()}

    roster_analysis, fill_gap_recs, reinforce_recs = draft_state.get_category_aware_recommendations(
        top_n=top_n,
        position_filter=pos_filter,
        scoring_mode=scoring_mode,  # type: ignore[arg-type]
        min_cost=min_cost,
        max_cost=max_cost,
        min_fpts=min_fpts,
        max_fpts=max_fpts,
        affordability_filter=affordability_filter,
        skipped_player_ids=skipped_player_ids if skipped_player_ids else None,
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


@router.get("/{session_id}/search", response_model=list[PlayerSearchResponse])
async def search_players(
    session_id: int,
    q: str,
    user: Annotated[User, Depends(get_current_user)],
    limit: int = 10,
    include_taken: bool = False,
    view: str = "actual",
) -> list[PlayerSearchResponse]:
    """Search for players by name."""
    _get_owned_session(session_id, user)

    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")

    db = get_session()
    try:
        draft_state = load_draft_state(db, session_id, view=view)
    finally:
        db.close()

    players = draft_state.search_players(query=q, limit=limit, include_taken=include_taken)

    my_ids = {dp.player.id for dp in draft_state.my_roster}

    return [
        PlayerSearchResponse(
            player_id=p.id,
            name=p.name,
            team=p.team,
            position=p.position.value if hasattr(p.position, "value") else p.position,
            projected_fpts=p.projected_fpts,
            auction_value=p.auction_value,
            is_available=p.id not in draft_state.taken_player_ids and p.id not in my_ids,
        )
        for p in players
    ]


# --- Room-aware endpoints ---


class ReportPickRequest(BaseModel):
    """Request to report a pick (any team)."""

    player_id: str
    member_id: int
    price: float = Field(ge=0)
    slot: str | None = None


class BoardTeamResponse(BaseModel):
    """A team's state on the draft board."""

    member_id: int
    team_name: str
    team_order: int
    is_phantom: bool
    user_id: int | None
    budget_total: int
    budget_remaining: float
    total_spent: float
    pick_count: int
    picks: list[dict[str, Any]]


class BoardStateResponse(BaseModel):
    """Full draft board state."""

    session_id: int
    num_teams: int
    roster_size: int
    teams: list[BoardTeamResponse]
    total_picks: int


@router.post("/{session_id}/report-pick")
async def report_pick(
    session_id: int,
    request: ReportPickRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    """Report a pick for any team in the room (honor system)."""
    db = get_session()
    try:
        # Verify user is a member of this room
        member = get_member_for_user(db, session_id, user.id)
        if member is None:
            raise HTTPException(status_code=403, detail="Not a member of this room")

        # Verify target member exists in this room
        target_member = db.get(RoomMember, request.member_id)
        if target_member is None or target_member.session_id != session_id:
            raise HTTPException(status_code=400, detail="Invalid team member")

        # Validate the pick via DraftState
        draft_state = load_room_draft_state(
            db, session_id, viewing_member_id=request.member_id
        )

        player = draft_state._player_pool.get(request.player_id)
        if not player:
            raise HTTPException(status_code=400, detail="Player not found")

        if request.player_id in draft_state.taken_player_ids or any(
            dp.player.id == request.player_id for dp in draft_state.my_roster
        ):
            raise HTTPException(status_code=400, detail="Player already taken")

        # Persist
        pick = persist_reported_pick(
            db=db,
            session_id=session_id,
            player_id=request.player_id,
            member_id=request.member_id,
            price=request.price,
            slot=request.slot,
            reported_by_user_id=user.id,
            player_name=player.name,
        )

        broadcast_data = {
            "type": "pick_reported",
            "player_id": request.player_id,
            "player_name": player.name,
            "team_name": target_member.team_name,
            "member_id": request.member_id,
            "price": request.price,
            "slot": request.slot,
            "reported_by": user.name,
            "pick_order": pick.pick_order,
        }

        # Broadcast to room
        await manager.broadcast_to_room(session_id, broadcast_data)

        return {
            "status": "reported",
            "player_id": request.player_id,
            "player_name": player.name,
            "member_id": request.member_id,
            "pick_order": pick.pick_order,
        }
    finally:
        db.close()


@router.post("/{session_id}/undo-pick")
async def undo_pick(
    session_id: int,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    """Undo the last pick in the room (any team)."""
    db = get_session()
    try:
        member = get_member_for_user(db, session_id, user.id)
        if member is None:
            raise HTTPException(status_code=403, detail="Not a member of this room")

        result = undo_room_last_pick(db, session_id, undone_by_user_id=user.id)
        if result is None:
            return {"status": "no_action", "message": "No picks to undo"}

        # Broadcast undo
        await manager.broadcast_to_room(
            session_id,
            {
                "type": "pick_undone",
                "player_id": result["player_id"],
                "player_name": result.get("player_name", result["player_id"]),
                "team_name": result["team_name"],
                "undone_by": user.name,
            },
        )

        return {"status": "undone", **result}
    finally:
        db.close()


@router.get("/{session_id}/state")
async def get_room_state(
    session_id: int,
    user: Annotated[User, Depends(get_current_user)],
    view: str = "actual",
) -> DraftStateResponse:
    """Get room state from the requesting user's team perspective."""
    db = get_session()
    try:
        member = get_member_for_user(db, session_id, user.id)
        if member is None:
            raise HTTPException(status_code=403, detail="Not a member of this room")

        draft_state = load_room_draft_state(
            db, session_id, viewing_member_id=member.id, view=view
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    finally:
        db.close()

    roster = [
        RosterPlayerResponse(
            player_id=dp.player.id,
            name=dp.player.name,
            team=dp.player.team,
            position=dp.player.position.value if hasattr(dp.player.position, "value") else dp.player.position,
            slot=dp.slot.value,
            cost=dp.cost,
            projected_fpts=dp.player.projected_fpts,
        )
        for dp in draft_state.my_roster
    ]

    taken_players = [
        TakenPlayerResponse(
            player_id=p.id,
            name=p.name,
            team=p.team,
            position=p.position.value if hasattr(p.position, "value") else p.position,
            projected_fpts=p.projected_fpts,
            auction_value=p.auction_value,
        )
        for p in draft_state.get_taken_players()
    ]

    return DraftStateResponse(
        session_id=session_id,
        my_roster=roster,
        budget_remaining=draft_state.my_budget_remaining,
        budget_total=draft_state.config.budget,
        roster_size=draft_state.roster_size,
        roster_spots_remaining=draft_state.roster_spots_remaining,
        players_taken_by_others=len(draft_state.taken_player_ids),
        players_available=len(draft_state.available_players),
        slots_needed=[s.value for s in draft_state._slots_needed],
        taken_players=taken_players,
    )


@router.get("/{session_id}/board", response_model=BoardStateResponse)
async def get_board(
    session_id: int,
    user: Annotated[User, Depends(get_current_user)],
) -> BoardStateResponse:
    """Get draft board grid data (all teams, all picks)."""
    db = get_session()
    try:
        member = get_member_for_user(db, session_id, user.id)
        if member is None:
            raise HTTPException(status_code=403, detail="Not a member of this room")

        board = get_room_board_state(db, session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    finally:
        db.close()

    return BoardStateResponse(
        session_id=board["session_id"],
        num_teams=board["num_teams"],
        roster_size=board["roster_size"],
        teams=[
            BoardTeamResponse(
                member_id=t["member_id"],
                team_name=t["team_name"],
                team_order=t["team_order"],
                is_phantom=t["is_phantom"],
                user_id=t["user_id"],
                budget_total=t["budget_total"],
                budget_remaining=t["budget_remaining"],
                total_spent=t["total_spent"],
                pick_count=t["pick_count"],
                picks=t["picks"],
            )
            for t in board["teams"]
        ],
        total_picks=board["total_picks"],
    )


@router.get("/{session_id}/room-recommendations", response_model=CategoryRecommendationsResponse)
async def get_room_recommendations(
    session_id: int,
    user: Annotated[User, Depends(get_current_user)],
    top_n: int = 10,
    position: str | None = None,
    scoring_mode: str = "balanced",
    min_cost: float | None = None,
    max_cost: float | None = None,
    min_fpts: float | None = None,
    max_fpts: float | None = None,
    affordability: str | None = None,
    skipped_ids: str | None = None,
    view: str = "actual",
) -> CategoryRecommendationsResponse:
    """Get category-aware recommendations from the user's team perspective."""
    db = get_session()
    try:
        member = get_member_for_user(db, session_id, user.id)
        if member is None:
            raise HTTPException(status_code=403, detail="Not a member of this room")

        draft_state = load_room_draft_state(
            db, session_id, viewing_member_id=member.id, view=view
        )

        db_skipped = get_skipped_player_ids(db, session_id)
    finally:
        db.close()

    pos_filter = Position(position) if position else None

    valid_modes = ("balanced", "value", "production")
    if scoring_mode not in valid_modes:
        scoring_mode = "balanced"

    affordability_filter = None
    if affordability:
        with contextlib.suppress(ValueError):
            affordability_filter = [
                AffordabilityTag(tag.strip())
                for tag in affordability.split(",")
                if tag.strip()
            ]

    skipped_player_ids = set(db_skipped)
    if skipped_ids:
        skipped_player_ids |= {pid.strip() for pid in skipped_ids.split(",") if pid.strip()}

    roster_analysis, fill_gap_recs, reinforce_recs = draft_state.get_category_aware_recommendations(
        top_n=top_n,
        position_filter=pos_filter,
        scoring_mode=scoring_mode,  # type: ignore[arg-type]
        min_cost=min_cost,
        max_cost=max_cost,
        min_fpts=min_fpts,
        max_fpts=max_fpts,
        affordability_filter=affordability_filter,
        skipped_player_ids=skipped_player_ids if skipped_player_ids else None,
    )

    def _to_rec_response(rec: Any) -> CategoryAwareRecommendationResponse:
        return CategoryAwareRecommendationResponse(
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
        fill_gap_recommendations=[_to_rec_response(r) for r in fill_gap_recs],
        reinforce_recommendations=[_to_rec_response(r) for r in reinforce_recs],
    )


@router.get("/{session_id}/room-search", response_model=list[PlayerSearchResponse])
async def search_room_players(
    session_id: int,
    q: str,
    user: Annotated[User, Depends(get_current_user)],
    limit: int = 10,
    include_taken: bool = False,
    view: str = "actual",
) -> list[PlayerSearchResponse]:
    """Search for available players in a room context."""
    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")

    db = get_session()
    try:
        member = get_member_for_user(db, session_id, user.id)
        if member is None:
            raise HTTPException(status_code=403, detail="Not a member of this room")

        draft_state = load_room_draft_state(
            db, session_id, viewing_member_id=member.id, view=view
        )
    finally:
        db.close()

    players = draft_state.search_players(query=q, limit=limit, include_taken=include_taken)
    my_ids = {dp.player.id for dp in draft_state.my_roster}

    return [
        PlayerSearchResponse(
            player_id=p.id,
            name=p.name,
            team=p.team,
            position=p.position.value if hasattr(p.position, "value") else p.position,
            projected_fpts=p.projected_fpts,
            auction_value=p.auction_value,
            is_available=p.id not in draft_state.taken_player_ids and p.id not in my_ids,
        )
        for p in players
    ]
