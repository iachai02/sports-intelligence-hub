"""Authentication API endpoints."""

from datetime import datetime, timedelta
from typing import Annotated, Any

from core.db.connection import get_session
from core.db.models import User
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from api.auth.dependencies import get_current_user
from api.auth.jwt import clear_auth_cookie, create_access_token, set_auth_cookie
from api.auth.oauth import OAuthError, exchange_google_code

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# Request/Response Models


class GoogleAuthRequest(BaseModel):
    """Request to authenticate with Google."""

    code: str
    redirect_uri: str
    code_verifier: str | None = None


class UserResponse(BaseModel):
    """User profile response."""

    id: int
    email: str
    name: str | None
    avatar_url: str | None
    preferences: dict[str, Any]
    created_at: datetime


class UpdatePreferencesRequest(BaseModel):
    """Request to update user preferences."""

    preferences: dict[str, Any]


# Type alias for authenticated user dependency
CurrentUser = Annotated[User, Depends(get_current_user)]


# Endpoints


@router.post("/google", response_model=UserResponse)
async def google_auth(request: GoogleAuthRequest, response: Response) -> UserResponse:
    """Exchange Google auth code for JWT and set cookie.

    This endpoint:
    1. Exchanges the authorization code for tokens with Google
    2. Fetches user info from Google
    3. Creates or updates the user in the database
    4. Sets an httpOnly JWT cookie
    5. Returns the user profile
    """
    try:
        google_user = await exchange_google_code(
            code=request.code,
            redirect_uri=request.redirect_uri,
            code_verifier=request.code_verifier,
        )
    except OAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    session = get_session()
    try:
        # Check for existing user by oauth_id
        result = session.execute(
            select(User).where(
                User.oauth_provider == "google",
                User.oauth_id == google_user.id,
            )
        )
        user = result.scalar_one_or_none()

        if user:
            # Update existing user
            user.email = google_user.email
            user.name = google_user.name
            user.avatar_url = google_user.picture
            user.last_login = datetime.utcnow()
        else:
            # Create new user
            user = User(
                email=google_user.email,
                name=google_user.name,
                avatar_url=google_user.picture,
                oauth_provider="google",
                oauth_id=google_user.id,
                preferences={},
                last_login=datetime.utcnow(),
            )
            session.add(user)

        session.commit()
        session.refresh(user)

        # Create JWT token
        token = create_access_token({"sub": str(user.id)})
        set_auth_cookie(response, token)

        return UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            preferences=user.preferences or {},
            created_at=user.created_at,
        )
    finally:
        session.close()


@router.get("/me", response_model=UserResponse)
def get_me(user: CurrentUser) -> UserResponse:
    """Get the current authenticated user's profile."""
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        preferences=user.preferences or {},
        created_at=user.created_at,
    )


@router.patch("/me", response_model=UserResponse)
def update_me(
    request: UpdatePreferencesRequest,
    user: CurrentUser,
) -> UserResponse:
    """Update the current user's preferences."""
    session = get_session()
    try:
        # Merge new preferences with existing
        current_prefs = user.preferences or {}
        current_prefs.update(request.preferences)

        # Update in database
        result = session.execute(select(User).where(User.id == user.id))
        db_user = result.scalar_one()
        db_user.preferences = current_prefs
        session.commit()
        session.refresh(db_user)

        return UserResponse(
            id=db_user.id,
            email=db_user.email,
            name=db_user.name,
            avatar_url=db_user.avatar_url,
            preferences=db_user.preferences or {},
            created_at=db_user.created_at,
        )
    finally:
        session.close()


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    """Log out the current user by clearing the auth cookie."""
    clear_auth_cookie(response)
    return {"status": "logged_out"}


@router.get("/ws-token")
def get_ws_token(user: CurrentUser) -> dict[str, str]:
    """Get a short-lived JWT token for WebSocket connections.

    Since httpOnly cookies can't be read by JS for WS query params,
    this endpoint issues a short-lived token (30 seconds) specifically
    for WS authentication.
    """
    token = create_access_token(
        {"sub": str(user.id), "type": "ws"},
        expires_delta=timedelta(seconds=30),
    )
    return {"token": token}
