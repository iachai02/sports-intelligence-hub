"""Session persistence service for draft sessions.

Handles loading/saving draft state from/to PostgreSQL.
Pattern: load from DB -> reconstruct DraftState -> compute -> persist mutations back.
"""

import logging
from datetime import datetime
from typing import Any

from core.db.models import (
    DraftPick,
    DraftSession,
    RoomActivityLog,
    RoomMember,
    SkippedPlayer,
    TakenPlayer,
)
from core.utils.friend_code import generate_friend_code
from sqlalchemy import select
from sqlalchemy.orm import Session

from draft_optimizer.draft_room import DraftState
from draft_optimizer.real_data import load_real_players_from_api
from draft_optimizer.schemas import PlayerProjection, RosterConfig, RosterSlot

logger = logging.getLogger(__name__)

# In-memory player pool cache keyed by season string.
# NBA API only called once per season per server lifecycle.
_player_pool_cache: dict[str, list[PlayerProjection]] = {}


def _get_player_pool(season: str) -> list[PlayerProjection]:
    """Get player pool for a season, caching across calls."""
    if season not in _player_pool_cache:
        logger.info(f"Loading player pool for season {season} (first time)")
        players = load_real_players_from_api(season=season, min_games=20)
        if not players:
            raise ValueError(f"Failed to load player pool for season {season}")
        _player_pool_cache[season] = players
    return _player_pool_cache[season]


def create_db_session(
    db: Session,
    user_id: int,
    name: str,
    budget: int = 200,
    roster_size: int = 13,
    num_teams: int = 12,
    season: str = "2024-25",
) -> tuple[DraftSession, DraftState]:
    """Create a new draft session in the database and return the DraftState.

    Args:
        db: SQLAlchemy session
        user_id: Owner user ID
        name: Session name
        budget: Total auction budget
        roster_size: Number of roster spots
        num_teams: Number of teams in league
        season: NBA season string

    Returns:
        Tuple of (DraftSession DB record, DraftState computation engine)
    """
    player_pool = _get_player_pool(season)

    # Generate unique friend code
    code = generate_friend_code()
    for _ in range(10):
        existing = db.execute(
            select(DraftSession).where(DraftSession.friend_code == code)
        ).scalar_one_or_none()
        if not existing:
            break
        code = generate_friend_code()

    db_session = DraftSession(
        user_id=user_id,
        name=name,
        friend_code=code,
        budget_total=budget,
        roster_size=roster_size,
        num_teams=num_teams,
        season=season,
        status="active",
    )
    db.add(db_session)
    db.flush()

    # Create a default RoomMember for the session owner
    member = RoomMember(
        session_id=db_session.id,
        user_id=user_id,
        team_name="My Team",
        team_order=0,
        is_phantom=False,
    )
    db.add(member)
    db.commit()
    db.refresh(db_session)

    config = RosterConfig(budget=float(budget))
    draft_state = DraftState(
        player_pool=player_pool,
        config=config,
        num_teams=num_teams,
    )
    # Override the random UUID with the DB session ID
    draft_state.session_id = str(db_session.id)

    return db_session, draft_state


def load_draft_state(db: Session, session_id: int) -> DraftState:
    """Reconstruct a DraftState from database records.

    Loads session config, reloads player pool (cached), replays picks + taken players.

    Args:
        db: SQLAlchemy session
        session_id: Draft session ID

    Returns:
        Fully reconstructed DraftState

    Raises:
        ValueError: If session not found
    """
    db_session = db.get(DraftSession, session_id)
    if db_session is None:
        raise ValueError(f"Session {session_id} not found")

    player_pool = _get_player_pool(db_session.season)

    config = RosterConfig(budget=float(db_session.budget_total))
    draft_state = DraftState(
        player_pool=player_pool,
        config=config,
        num_teams=db_session.num_teams,
    )
    draft_state.session_id = str(db_session.id)

    # Replay picks in order
    picks = (
        db.execute(
            select(DraftPick)
            .where(DraftPick.session_id == session_id)
            .order_by(DraftPick.pick_order.asc().nulls_last(), DraftPick.picked_at.asc())
        )
        .scalars()
        .all()
    )

    for pick in picks:
        slot = RosterSlot(pick.slot) if pick.slot else None
        try:
            draft_state.draft_player_for_me(
                player_id=pick.player_id,
                cost=pick.purchase_price,
                slot=slot,
            )
        except ValueError:
            logger.warning(
                f"Could not replay pick for player {pick.player_id} "
                f"in session {session_id}"
            )

    # Replay taken players
    taken = (
        db.execute(
            select(TakenPlayer)
            .where(TakenPlayer.session_id == session_id)
            .order_by(TakenPlayer.marked_at.asc())
        )
        .scalars()
        .all()
    )

    for tp in taken:
        try:
            draft_state.mark_player_taken(tp.player_id)
        except ValueError:
            logger.warning(
                f"Could not replay taken player {tp.player_id} "
                f"in session {session_id}"
            )

    # Clear action history since we replayed from DB
    # (undo is handled at DB level, not via in-memory history)
    draft_state._action_history.clear()

    return draft_state


def persist_draft_pick(
    db: Session,
    session_id: int,
    player_id: str,
    price: float,
    slot: str | None,
    pick_order: int | None = None,
    suggested_price: float | None = None,
) -> DraftPick:
    """Persist a draft pick to the database.

    Args:
        db: SQLAlchemy session
        session_id: Draft session ID
        player_id: Player ID
        price: Purchase price
        slot: Roster slot assigned
        pick_order: Order of pick in draft
        suggested_price: Model's suggested price

    Returns:
        Created DraftPick record
    """
    # Auto-calculate pick_order if not provided
    if pick_order is None:
        count = db.execute(
            select(DraftPick)
            .where(DraftPick.session_id == session_id)
        ).scalars().all()
        pick_order = len(count) + 1

    pick = DraftPick(
        session_id=session_id,
        player_id=player_id,
        purchase_price=price,
        suggested_price=suggested_price,
        slot=slot,
        pick_order=pick_order,
    )
    db.add(pick)
    db.commit()
    db.refresh(pick)
    return pick


def persist_taken_player(
    db: Session,
    session_id: int,
    player_id: str,
) -> TakenPlayer:
    """Persist a taken player mark to the database."""
    taken = TakenPlayer(
        session_id=session_id,
        player_id=player_id,
    )
    db.add(taken)
    db.commit()
    db.refresh(taken)
    return taken


def persist_skipped_player(
    db: Session,
    session_id: int,
    player_id: str,
    reason: str | None = None,
) -> SkippedPlayer:
    """Persist a skipped player to the database."""
    skipped = SkippedPlayer(
        session_id=session_id,
        player_id=player_id,
        skip_reason=reason,
    )
    db.add(skipped)
    db.commit()
    db.refresh(skipped)
    return skipped


def undo_last_action(
    db: Session,
    session_id: int,
) -> dict[str, str] | None:
    """Undo the last action by comparing timestamps.

    Compares the timestamp of the last pick vs last taken player,
    deletes whichever is newer.

    Returns:
        Dict with action_type and player_id, or None if nothing to undo
    """
    # Get the last pick
    last_pick = (
        db.execute(
            select(DraftPick)
            .where(DraftPick.session_id == session_id)
            .order_by(DraftPick.picked_at.desc())
        )
        .scalars()
        .first()
    )

    # Get the last taken player
    last_taken = (
        db.execute(
            select(TakenPlayer)
            .where(TakenPlayer.session_id == session_id)
            .order_by(TakenPlayer.marked_at.desc())
        )
        .scalars()
        .first()
    )

    if last_pick is None and last_taken is None:
        return None

    # Compare timestamps, delete the newer one
    pick_time = last_pick.picked_at if last_pick else datetime.min
    taken_time = last_taken.marked_at if last_taken else datetime.min

    if pick_time >= taken_time and last_pick is not None:
        player_id = last_pick.player_id
        db.delete(last_pick)
        db.commit()
        return {"action_type": "draft_for_me", "player_id": player_id}
    elif last_taken is not None:
        player_id = last_taken.player_id
        db.delete(last_taken)
        db.commit()
        return {"action_type": "mark_taken", "player_id": player_id}

    return None


def list_user_sessions(
    db: Session,
    user_id: int,
) -> list[DraftSession]:
    """List all draft sessions for a user, newest first."""
    return list(
        db.execute(
            select(DraftSession)
            .where(DraftSession.user_id == user_id)
            .order_by(DraftSession.created_at.desc())
        )
        .scalars()
        .all()
    )


def get_db_session_record(
    db: Session,
    session_id: int,
    user_id: int | None = None,
) -> DraftSession | None:
    """Get a draft session by ID, optionally filtering by user.

    Args:
        db: SQLAlchemy session
        session_id: Draft session ID
        user_id: If provided, verify ownership

    Returns:
        DraftSession or None
    """
    stmt = select(DraftSession).where(DraftSession.id == session_id)
    if user_id is not None:
        stmt = stmt.where(DraftSession.user_id == user_id)
    return db.execute(stmt).scalars().first()


def delete_db_session(
    db: Session,
    session_id: int,
) -> bool:
    """Delete a draft session (cascades to picks, taken, skipped, preferences)."""
    db_session = db.get(DraftSession, session_id)
    if db_session is None:
        return False
    db.delete(db_session)
    db.commit()
    return True


def get_skipped_player_ids(
    db: Session,
    session_id: int,
) -> set[str]:
    """Get set of skipped player IDs for a session."""
    skipped = (
        db.execute(
            select(SkippedPlayer.player_id)
            .where(SkippedPlayer.session_id == session_id)
        )
        .scalars()
        .all()
    )
    return set(skipped)


def get_pick_count(
    db: Session,
    session_id: int,
) -> int:
    """Get the number of picks in a session."""
    picks = (
        db.execute(
            select(DraftPick)
            .where(DraftPick.session_id == session_id)
        )
        .scalars()
        .all()
    )
    return len(picks)


# --- Room-aware persistence functions ---


def load_room_draft_state(
    db: Session,
    session_id: int,
    viewing_member_id: int | None = None,
) -> DraftState:
    """Reconstruct a DraftState for a room, from a specific team's perspective.

    If viewing_member_id is provided, that member's picks become "my_roster"
    and all other picks become "taken". If not provided, falls back to
    the original single-user behavior (all picks go to my_roster).

    Args:
        db: SQLAlchemy session
        session_id: Draft session ID
        viewing_member_id: RoomMember ID whose perspective to use

    Returns:
        Fully reconstructed DraftState
    """
    db_session = db.get(DraftSession, session_id)
    if db_session is None:
        raise ValueError(f"Session {session_id} not found")

    player_pool = _get_player_pool(db_session.season)

    config = RosterConfig(budget=float(db_session.budget_total))
    draft_state = DraftState(
        player_pool=player_pool,
        config=config,
        num_teams=db_session.num_teams,
    )
    draft_state.session_id = str(db_session.id)

    # Get all picks ordered
    picks = (
        db.execute(
            select(DraftPick)
            .where(DraftPick.session_id == session_id)
            .order_by(DraftPick.pick_order.asc().nulls_last(), DraftPick.picked_at.asc())
        )
        .scalars()
        .all()
    )

    for pick in picks:
        is_my_pick = (
            viewing_member_id is not None
            and pick.drafter_member_id == viewing_member_id
        ) or (viewing_member_id is None and pick.drafter_member_id is None)

        slot = RosterSlot(pick.slot) if pick.slot else None
        try:
            if is_my_pick:
                draft_state.draft_player_for_me(
                    player_id=pick.player_id,
                    cost=pick.purchase_price,
                    slot=slot,
                )
            else:
                draft_state.mark_player_taken(pick.player_id)
        except ValueError:
            logger.warning(
                f"Could not replay pick for player {pick.player_id} "
                f"in session {session_id}"
            )

    # Replay taken players (players marked as taken outside of picks)
    taken = (
        db.execute(
            select(TakenPlayer)
            .where(TakenPlayer.session_id == session_id)
            .order_by(TakenPlayer.marked_at.asc())
        )
        .scalars()
        .all()
    )

    for tp in taken:
        try:
            draft_state.mark_player_taken(tp.player_id)
        except ValueError:
            logger.warning(
                f"Could not replay taken player {tp.player_id} "
                f"in session {session_id}"
            )

    draft_state._action_history.clear()
    return draft_state


def persist_reported_pick(
    db: Session,
    session_id: int,
    player_id: str,
    member_id: int,
    price: float,
    slot: str | None,
    reported_by_user_id: int,
    player_name: str | None = None,
) -> DraftPick:
    """Persist a pick reported by any room member for any team.

    Args:
        db: SQLAlchemy session
        session_id: Draft session ID
        player_id: Player ID
        member_id: RoomMember ID who drafted the player
        price: Purchase price
        slot: Roster slot
        reported_by_user_id: User who reported this pick

    Returns:
        Created DraftPick record
    """
    # Calculate pick order
    existing_picks = (
        db.execute(
            select(DraftPick).where(DraftPick.session_id == session_id)
        )
        .scalars()
        .all()
    )
    pick_order = len(existing_picks) + 1

    pick = DraftPick(
        session_id=session_id,
        player_id=player_id,
        drafter_member_id=member_id,
        purchase_price=price,
        slot=slot,
        pick_order=pick_order,
    )
    db.add(pick)

    # Log activity
    member = db.get(RoomMember, member_id)
    team_name = member.team_name if member else "Unknown"

    log_entry = RoomActivityLog(
        session_id=session_id,
        user_id=reported_by_user_id,
        action_type="pick_reported",
        payload={
            "player_id": player_id,
            "player_name": player_name or player_id,
            "team_name": team_name,
            "member_id": member_id,
            "price": price,
            "slot": slot,
            "pick_order": pick_order,
        },
    )
    db.add(log_entry)

    db.commit()
    db.refresh(pick)
    return pick


def undo_room_last_pick(
    db: Session,
    session_id: int,
    undone_by_user_id: int,
) -> dict[str, str] | None:
    """Undo the most recent pick across all teams in the room.

    Args:
        db: SQLAlchemy session
        session_id: Draft session ID
        undone_by_user_id: User who initiated the undo

    Returns:
        Dict with action details, or None if nothing to undo
    """
    last_pick = (
        db.execute(
            select(DraftPick)
            .where(DraftPick.session_id == session_id)
            .order_by(DraftPick.picked_at.desc())
        )
        .scalars()
        .first()
    )

    if last_pick is None:
        return None

    player_id = last_pick.player_id
    member_id = last_pick.drafter_member_id
    team_name = "Unknown"
    if member_id:
        member = db.get(RoomMember, member_id)
        if member:
            team_name = member.team_name

    # Look up player name from cached pool
    player_name = player_id
    session_record = db.get(DraftSession, session_id)
    if session_record:
        season = session_record.season or "2024-25"
        if season in _player_pool_cache:
            for p in _player_pool_cache[season]:
                if p.id == player_id:
                    player_name = p.name
                    break

    db.delete(last_pick)

    # Log undo
    log_entry = RoomActivityLog(
        session_id=session_id,
        user_id=undone_by_user_id,
        action_type="pick_undone",
        payload={
            "player_id": player_id,
            "player_name": player_name,
            "team_name": team_name,
            "member_id": member_id,
        },
    )
    db.add(log_entry)

    db.commit()
    return {
        "action_type": "pick_undone",
        "player_id": player_id,
        "player_name": player_name,
        "team_name": team_name,
    }


def get_room_board_state(
    db: Session,
    session_id: int,
) -> dict[str, Any]:
    """Get full board state: all teams, all picks, budget summaries.

    Returns:
        Dict with teams and their picks/budgets
    """
    db_session = db.get(DraftSession, session_id)
    if db_session is None:
        raise ValueError(f"Session {session_id} not found")

    members = (
        db.execute(
            select(RoomMember)
            .where(RoomMember.session_id == session_id)
            .order_by(RoomMember.team_order)
        )
        .scalars()
        .all()
    )

    picks = (
        db.execute(
            select(DraftPick)
            .where(DraftPick.session_id == session_id)
            .order_by(DraftPick.pick_order.asc().nulls_last())
        )
        .scalars()
        .all()
    )

    # Build player name lookup from cached pool
    player_name_map: dict[str, str] = {}
    try:
        pool = _get_player_pool(db_session.season)
        player_name_map = {p.id: p.name for p in pool}
    except Exception:
        pass  # Gracefully degrade if pool unavailable

    # Build picks per member
    picks_by_member: dict[int, list[dict[str, Any]]] = {}
    for pick in picks:
        mid = pick.drafter_member_id or 0
        if mid not in picks_by_member:
            picks_by_member[mid] = []
        picks_by_member[mid].append({
            "player_id": pick.player_id,
            "player_name": player_name_map.get(pick.player_id, pick.player_id),
            "purchase_price": pick.purchase_price,
            "slot": pick.slot,
            "pick_order": pick.pick_order,
            "picked_at": pick.picked_at.isoformat(),
        })

    teams = []
    for m in members:
        member_picks = picks_by_member.get(m.id, [])
        total_spent = sum(p["purchase_price"] for p in member_picks)
        budget_total = m.budget_total or db_session.budget_total
        teams.append({
            "member_id": m.id,
            "team_name": m.team_name,
            "team_order": m.team_order,
            "is_phantom": m.is_phantom,
            "user_id": m.user_id,
            "budget_total": budget_total,
            "budget_remaining": budget_total - total_spent,
            "total_spent": total_spent,
            "picks": member_picks,
            "pick_count": len(member_picks),
        })

    return {
        "session_id": session_id,
        "num_teams": db_session.num_teams,
        "roster_size": db_session.roster_size,
        "teams": teams,
        "total_picks": len(picks),
    }


def get_member_for_user(
    db: Session,
    session_id: int,
    user_id: int,
) -> RoomMember | None:
    """Get the RoomMember record for a user in a session."""
    return db.execute(
        select(RoomMember).where(
            RoomMember.session_id == session_id,
            RoomMember.user_id == user_id,
            RoomMember.is_phantom.is_(False),
        )
    ).scalar_one_or_none()
