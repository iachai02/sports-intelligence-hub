"""WebSocket connection manager for draft rooms."""

import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections organized by room (session) and user."""

    def __init__(self) -> None:
        # room_id -> {user_id -> WebSocket}
        self._connections: dict[int, dict[int, WebSocket]] = {}

    async def connect(self, room_id: int, user_id: int, websocket: WebSocket) -> None:
        """Accept a WebSocket connection and register it."""
        await websocket.accept()
        if room_id not in self._connections:
            self._connections[room_id] = {}
        self._connections[room_id][user_id] = websocket
        logger.info(f"User {user_id} connected to room {room_id}")

    def disconnect(self, room_id: int, user_id: int) -> None:
        """Remove a WebSocket connection."""
        if room_id in self._connections:
            self._connections[room_id].pop(user_id, None)
            if not self._connections[room_id]:
                del self._connections[room_id]
        logger.info(f"User {user_id} disconnected from room {room_id}")

    async def broadcast_to_room(
        self,
        room_id: int,
        message: dict[str, Any],
        exclude_user_id: int | None = None,
    ) -> None:
        """Send a message to all connected users in a room.

        Args:
            room_id: The draft session/room ID.
            message: The message payload to send as JSON.
            exclude_user_id: Optional user ID to exclude from broadcast.
        """
        connections = self._connections.get(room_id, {})
        dead_connections: list[int] = []

        for uid, ws in connections.items():
            if exclude_user_id is not None and uid == exclude_user_id:
                continue
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                logger.warning(f"Failed to send to user {uid} in room {room_id}")
                dead_connections.append(uid)

        # Clean up dead connections
        for uid in dead_connections:
            self.disconnect(room_id, uid)

    def get_connected_users(self, room_id: int) -> list[int]:
        """Get list of connected user IDs for a room."""
        return list(self._connections.get(room_id, {}).keys())

    def is_user_connected(self, room_id: int, user_id: int) -> bool:
        """Check if a user is connected to a room."""
        return user_id in self._connections.get(room_id, {})
