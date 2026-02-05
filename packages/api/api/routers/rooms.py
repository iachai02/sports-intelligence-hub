"""Room management API endpoints for multi-user draft rooms."""

from typing import Annotated, Any

from core.db.connection import get_session
from core.db.models import DraftSession, RoomActivityLog, RoomMember, User
from core.utils.friend_code import generate_friend_code
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from api.auth.dependencies import get_current_user
from api.websocket import manager

router = APIRouter(prefix="/api/v1/rooms", tags=["rooms"])


# --- Request/Response Models ---


class CreateRoomRequest(BaseModel):
    """Request to create a new draft room."""

    name: str = Field(default="Draft Room", max_length=100)
    budget: int = Field(default=200, ge=50, le=1000)
    num_teams: int = Field(default=12, ge=4, le=20)
    season: str = Field(default="2024-25")
    team_name: str = Field(default="My Team", max_length=100)


class CreateRoomResponse(BaseModel):
    """Response from room creation."""

    room_id: int
    friend_code: str
    name: str
    budget: int
    num_teams: int


class JoinRoomRequest(BaseModel):
    """Request to join a room via friend code."""

    friend_code: str = Field(max_length=8)
    team_name: str = Field(max_length=100)


class RoomMemberResponse(BaseModel):
    """A member in the room."""

    id: int
    user_id: int | None
    team_name: str
    team_order: int
    is_phantom: bool
    is_online: bool
    user_name: str | None = None
    user_avatar: str | None = None


class RoomListItem(BaseModel):
    """Summary of a room for listing."""

    id: int
    name: str
    friend_code: str
    status: str
    budget_total: int
    num_teams: int
    season: str
    member_count: int
    created_at: str


class RoomDetailResponse(BaseModel):
    """Full room details."""

    id: int
    name: str
    friend_code: str
    draft_format: str
    status: str
    budget_total: int
    roster_size: int
    num_teams: int
    season: str
    commissioner_id: int
    members: list[RoomMemberResponse]
    created_at: str


class ActivityLogEntry(BaseModel):
    """An activity log entry."""

    id: int
    action_type: str
    payload: dict[str, Any] | None
    user_name: str | None
    created_at: str


# --- Helper ---


def _get_room_membership(
    session_id: int, user: User
) -> tuple[DraftSession, RoomMember]:
    """Get the room and the user's membership, or raise 404/403."""
    db = get_session()
    try:
        room = db.get(DraftSession, session_id)
        if room is None:
            raise HTTPException(status_code=404, detail="Room not found")

        member = db.execute(
            select(RoomMember).where(
                RoomMember.session_id == session_id,
                RoomMember.user_id == user.id,
                RoomMember.is_phantom.is_(False),
            )
        ).scalar_one_or_none()

        if member is None:
            raise HTTPException(status_code=403, detail="Not a member of this room")

        return room, member
    finally:
        db.close()


# --- Endpoints ---


@router.post("/", response_model=CreateRoomResponse)
async def create_room(
    request: CreateRoomRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> CreateRoomResponse:
    """Create a new draft room. The creator becomes the commissioner."""
    db = get_session()
    try:
        # Generate unique friend code
        for _ in range(10):
            code = generate_friend_code()
            existing = db.execute(
                select(DraftSession).where(DraftSession.friend_code == code)
            ).scalar_one_or_none()
            if not existing:
                break
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate unique friend code",
            )

        # Create the draft session (room)
        room = DraftSession(
            user_id=user.id,
            name=request.name,
            friend_code=code,
            draft_format="auction",
            budget_total=request.budget,
            num_teams=request.num_teams,
            season=request.season,
            status="waiting",
        )
        db.add(room)
        db.flush()

        # Create commissioner member
        commissioner_member = RoomMember(
            session_id=room.id,
            user_id=user.id,
            team_name=request.team_name,
            team_order=0,
            is_phantom=False,
        )
        db.add(commissioner_member)

        # Create phantom members for remaining team slots
        for i in range(1, request.num_teams):
            phantom = RoomMember(
                session_id=room.id,
                user_id=None,
                team_name=f"Team {i + 1}",
                team_order=i,
                is_phantom=True,
            )
            db.add(phantom)

        # Log room creation
        log_entry = RoomActivityLog(
            session_id=room.id,
            user_id=user.id,
            action_type="room_created",
            payload={"room_name": request.name, "num_teams": request.num_teams},
        )
        db.add(log_entry)

        db.commit()
        db.refresh(room)

        return CreateRoomResponse(
            room_id=room.id,
            friend_code=room.friend_code,
            name=room.name,
            budget=room.budget_total,
            num_teams=room.num_teams,
        )
    finally:
        db.close()


@router.get("/", response_model=list[RoomListItem])
async def list_rooms(
    user: Annotated[User, Depends(get_current_user)],
) -> list[RoomListItem]:
    """List all rooms the user is a member of."""
    db = get_session()
    try:
        # Find rooms where user is a member (not phantom)
        memberships = (
            db.execute(
                select(RoomMember.session_id).where(
                    RoomMember.user_id == user.id,
                    RoomMember.is_phantom.is_(False),
                )
            )
            .scalars()
            .all()
        )

        if not memberships:
            return []

        rooms = (
            db.execute(
                select(DraftSession)
                .where(DraftSession.id.in_(memberships))
                .order_by(DraftSession.created_at.desc())
            )
            .scalars()
            .all()
        )

        result = []
        for room in rooms:
            # Count non-phantom members
            real_members = (
                db.execute(
                    select(RoomMember).where(
                        RoomMember.session_id == room.id,
                        RoomMember.is_phantom.is_(False),
                    )
                )
                .scalars()
                .all()
            )
            result.append(
                RoomListItem(
                    id=room.id,
                    name=room.name,
                    friend_code=room.friend_code,
                    status=room.status,
                    budget_total=room.budget_total,
                    num_teams=room.num_teams,
                    season=room.season,
                    member_count=len(real_members),
                    created_at=room.created_at.isoformat(),
                )
            )
        return result
    finally:
        db.close()


@router.get("/{room_id}", response_model=RoomDetailResponse)
async def get_room(
    room_id: int,
    user: Annotated[User, Depends(get_current_user)],
) -> RoomDetailResponse:
    """Get room details including members and online status."""
    room, _ = _get_room_membership(room_id, user)

    db = get_session()
    try:
        # Re-fetch room in this session
        room = db.get(DraftSession, room_id)
        if room is None:
            raise HTTPException(status_code=404, detail="Room not found")

        members = (
            db.execute(
                select(RoomMember)
                .where(RoomMember.session_id == room_id)
                .order_by(RoomMember.team_order)
            )
            .scalars()
            .all()
        )

        connected_users = manager.get_connected_users(room_id)

        member_responses = []
        for m in members:
            user_name = None
            user_avatar = None
            if m.user_id and m.user:
                user_name = m.user.name
                user_avatar = m.user.avatar_url

            member_responses.append(
                RoomMemberResponse(
                    id=m.id,
                    user_id=m.user_id,
                    team_name=m.team_name,
                    team_order=m.team_order,
                    is_phantom=m.is_phantom,
                    is_online=m.user_id in connected_users if m.user_id else False,
                    user_name=user_name,
                    user_avatar=user_avatar,
                )
            )

        return RoomDetailResponse(
            id=room.id,
            name=room.name,
            friend_code=room.friend_code,
            draft_format=room.draft_format,
            status=room.status,
            budget_total=room.budget_total,
            roster_size=room.roster_size,
            num_teams=room.num_teams,
            season=room.season,
            commissioner_id=room.user_id,
            members=member_responses,
            created_at=room.created_at.isoformat(),
        )
    finally:
        db.close()


@router.post("/join", response_model=RoomMemberResponse)
async def join_room(
    request: JoinRoomRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> RoomMemberResponse:
    """Join a room via friend code."""
    db = get_session()
    try:
        # Find the room
        room = db.execute(
            select(DraftSession).where(
                DraftSession.friend_code == request.friend_code.upper()
            )
        ).scalar_one_or_none()

        if not room:
            raise HTTPException(status_code=404, detail="Room not found with that code")

        if room.status not in ("waiting", "active"):
            raise HTTPException(
                status_code=400, detail="Room is no longer accepting members"
            )

        # Check if user is already a member
        existing = db.execute(
            select(RoomMember).where(
                RoomMember.session_id == room.id,
                RoomMember.user_id == user.id,
                RoomMember.is_phantom.is_(False),
            )
        ).scalar_one_or_none()

        if existing:
            raise HTTPException(status_code=400, detail="Already a member of this room")

        # Try to convert a phantom member to real
        phantom = db.execute(
            select(RoomMember)
            .where(
                RoomMember.session_id == room.id,
                RoomMember.is_phantom.is_(True),
            )
            .order_by(RoomMember.team_order)
        ).scalars().first()

        if phantom:
            phantom.user_id = user.id
            phantom.team_name = request.team_name
            phantom.is_phantom = False
            member = phantom
        else:
            # No phantom slots available — room is full
            raise HTTPException(
                status_code=400, detail="Room is full, no available team slots"
            )

        # Log join
        log_entry = RoomActivityLog(
            session_id=room.id,
            user_id=user.id,
            action_type="member_joined",
            payload={"team_name": request.team_name, "user_name": user.name},
        )
        db.add(log_entry)

        db.commit()
        db.refresh(member)

        # Broadcast join to room
        await manager.broadcast_to_room(
            room.id,
            {
                "type": "member_joined",
                "member_id": member.id,
                "user_id": user.id,
                "team_name": request.team_name,
                "user_name": user.name,
            },
        )

        return RoomMemberResponse(
            id=member.id,
            user_id=member.user_id,
            team_name=member.team_name,
            team_order=member.team_order,
            is_phantom=member.is_phantom,
            is_online=False,
            user_name=user.name,
            user_avatar=user.avatar_url,
        )
    finally:
        db.close()


@router.delete("/{room_id}/leave")
async def leave_room(
    room_id: int,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    """Leave a room. Commissioner cannot leave (must delete room instead)."""
    db = get_session()
    try:
        room = db.get(DraftSession, room_id)
        if room is None:
            raise HTTPException(status_code=404, detail="Room not found")

        if room.user_id == user.id:
            raise HTTPException(
                status_code=400,
                detail="Commissioner cannot leave. Delete the room instead.",
            )

        member = db.execute(
            select(RoomMember).where(
                RoomMember.session_id == room_id,
                RoomMember.user_id == user.id,
                RoomMember.is_phantom.is_(False),
            )
        ).scalar_one_or_none()

        if not member:
            raise HTTPException(status_code=404, detail="Not a member of this room")

        team_name = member.team_name

        # Convert back to phantom
        member.user_id = None
        member.team_name = f"Team {member.team_order + 1}"
        member.is_phantom = True

        # Log leave
        log_entry = RoomActivityLog(
            session_id=room_id,
            user_id=user.id,
            action_type="member_left",
            payload={"team_name": team_name, "user_name": user.name},
        )
        db.add(log_entry)

        db.commit()

        # Broadcast leave
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "member_left",
                "user_id": user.id,
                "team_name": team_name,
                "user_name": user.name,
            },
        )

        return {"status": "left", "room_id": str(room_id)}
    finally:
        db.close()


@router.get("/{room_id}/members", response_model=list[RoomMemberResponse])
async def get_members(
    room_id: int,
    user: Annotated[User, Depends(get_current_user)],
) -> list[RoomMemberResponse]:
    """Get member list for a room."""
    _get_room_membership(room_id, user)

    db = get_session()
    try:
        members = (
            db.execute(
                select(RoomMember)
                .where(RoomMember.session_id == room_id)
                .order_by(RoomMember.team_order)
            )
            .scalars()
            .all()
        )

        connected_users = manager.get_connected_users(room_id)

        return [
            RoomMemberResponse(
                id=m.id,
                user_id=m.user_id,
                team_name=m.team_name,
                team_order=m.team_order,
                is_phantom=m.is_phantom,
                is_online=m.user_id in connected_users if m.user_id else False,
                user_name=m.user.name if m.user else None,
                user_avatar=m.user.avatar_url if m.user else None,
            )
            for m in members
        ]
    finally:
        db.close()


@router.get("/{room_id}/activity", response_model=list[ActivityLogEntry])
async def get_activity(
    room_id: int,
    user: Annotated[User, Depends(get_current_user)],
    limit: int = 50,
    offset: int = 0,
) -> list[ActivityLogEntry]:
    """Get paginated activity log for a room."""
    _get_room_membership(room_id, user)

    db = get_session()
    try:
        logs = (
            db.execute(
                select(RoomActivityLog)
                .where(RoomActivityLog.session_id == room_id)
                .order_by(RoomActivityLog.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
            .scalars()
            .all()
        )

        return [
            ActivityLogEntry(
                id=log.id,
                action_type=log.action_type,
                payload=log.payload,
                user_name=log.user.name if log.user else None,
                created_at=log.created_at.isoformat(),
            )
            for log in logs
        ]
    finally:
        db.close()
