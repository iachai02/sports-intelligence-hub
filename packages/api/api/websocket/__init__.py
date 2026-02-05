"""WebSocket module for real-time draft room communication."""

from api.websocket.manager import ConnectionManager

manager = ConnectionManager()

__all__ = ["ConnectionManager", "manager"]
