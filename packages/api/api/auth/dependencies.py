"""FastAPI authentication dependencies."""

from core.db.connection import get_session
from core.db.models import User
from fastapi import Cookie, HTTPException, status
from sqlalchemy import select

from api.auth.jwt import verify_token


def get_current_user(
    token: str | None = Cookie(default=None, alias="sports_hub_token"),
) -> User:
    """Get the current authenticated user.

    Raises HTTPException 401 if not authenticated.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    session = get_session()
    try:
        result = session.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()
    finally:
        session.close()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def get_optional_user(
    token: str | None = Cookie(default=None, alias="sports_hub_token"),
) -> User | None:
    """Get the current user if authenticated, otherwise None.

    Does not raise an exception if not authenticated.
    """
    if not token:
        return None

    payload = verify_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    session = get_session()
    try:
        result = session.execute(select(User).where(User.id == int(user_id)))
        return result.scalar_one_or_none()
    finally:
        session.close()


def get_user_from_ws_token(token: str) -> User | None:
    """Authenticate a user from a short-lived WS token.

    WS tokens use the same JWT format but with a 'ws' type claim
    and shorter expiry.

    Args:
        token: The WS JWT token from query param.

    Returns:
        User or None if invalid.
    """
    payload = verify_token(token)
    if not payload:
        return None

    if payload.get("type") != "ws":
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    session = get_session()
    try:
        result = session.execute(select(User).where(User.id == int(user_id)))
        return result.scalar_one_or_none()
    finally:
        session.close()
