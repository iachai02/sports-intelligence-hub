"""JWT token handling."""

from datetime import datetime, timedelta
from typing import Any

import jwt
from fastapi import Response

from api.auth.config import auth_settings


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=auth_settings.token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    encoded: str = jwt.encode(
        to_encode, auth_settings.jwt_secret, algorithm=auth_settings.jwt_algorithm
    )
    return encoded


def verify_token(token: str) -> dict[str, Any] | None:
    """Verify a JWT token and return the payload."""
    try:
        payload: dict[str, Any] = jwt.decode(
            token, auth_settings.jwt_secret, algorithms=[auth_settings.jwt_algorithm]
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def set_auth_cookie(response: Response, token: str) -> None:
    """Set the authentication cookie on the response."""
    response.set_cookie(
        key=auth_settings.cookie_name,
        value=token,
        httponly=True,
        secure=auth_settings.cookie_secure,
        samesite=auth_settings.cookie_samesite,
        max_age=auth_settings.token_expire_minutes * 60,
    )


def clear_auth_cookie(response: Response) -> None:
    """Clear the authentication cookie."""
    response.delete_cookie(
        key=auth_settings.cookie_name,
        httponly=True,
        secure=auth_settings.cookie_secure,
        samesite=auth_settings.cookie_samesite,
    )
