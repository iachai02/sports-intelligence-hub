"""FastAPI application factory."""

# Load environment variables BEFORE importing modules that use them
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import auth, draft, draft_sessions, health, players, rooms, websocket


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Sports Intelligence Hub",
        description="NBA game predictions and fantasy draft optimization",
        version="0.1.0",
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3001"],  # React dev server (port 3001, 3000 used by leetcode-spaced-rep)
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    app.include_router(health.router, tags=["health"])
    app.include_router(auth.router, tags=["auth"])
    app.include_router(draft.router, tags=["draft"])
    app.include_router(draft_sessions.router, tags=["draft-sessions"])
    app.include_router(players.router, tags=["players"])
    app.include_router(rooms.router, tags=["rooms"])
    app.include_router(websocket.router, tags=["websocket"])

    return app


app = create_app()
