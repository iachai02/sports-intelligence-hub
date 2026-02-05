"""WebSocket endpoint for real-time draft room communication."""

import asyncio
import json
import logging

from core.db.connection import get_session
from core.db.models import RoomMember
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from api.auth.dependencies import get_user_from_ws_token
from api.websocket import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/room/{room_id}")
async def room_websocket(websocket: WebSocket, room_id: int, token: str = "") -> None:
    """WebSocket endpoint for real-time room updates.

    Clients connect with a short-lived WS token obtained from
    GET /api/v1/auth/ws-token. The server pushes events; clients
    only send "ping" keepalives.

    Events pushed:
    - pick_reported, pick_undone
    - member_joined, member_left, member_connected, member_disconnected
    - room_state_sync (on reconnect)
    - error
    """
    # Authenticate via token query param
    if not token:
        await websocket.accept()
        await websocket.close(code=4001, reason="Missing token")
        return

    user = get_user_from_ws_token(token)
    if not user:
        await websocket.accept()
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    # Verify user is a member of this room
    db = get_session()
    try:
        member = db.execute(
            select(RoomMember).where(
                RoomMember.session_id == room_id,
                RoomMember.user_id == user.id,
                RoomMember.is_phantom.is_(False),
            )
        ).scalar_one_or_none()

        if not member:
            await websocket.accept()
            await websocket.close(code=4003, reason="Not a member of this room")
            return
    finally:
        db.close()

    # Accept connection
    await manager.connect(room_id, user.id, websocket)

    # Notify room that user connected
    await manager.broadcast_to_room(
        room_id,
        {
            "type": "member_connected",
            "user_id": user.id,
            "user_name": user.name,
            "connected_users": manager.get_connected_users(room_id),
        },
        exclude_user_id=user.id,
    )

    try:
        while True:
            # Only expect "ping" keepalives from client
            data = await asyncio.wait_for(websocket.receive_text(), timeout=60)
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except (WebSocketDisconnect, TimeoutError):
        pass
    except Exception:
        logger.exception(f"WebSocket error for user {user.id} in room {room_id}")
    finally:
        manager.disconnect(room_id, user.id)
        # Notify room that user disconnected
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "member_disconnected",
                "user_id": user.id,
                "user_name": user.name,
                "connected_users": manager.get_connected_users(room_id),
            },
        )
