"""Authentication module."""

from api.auth.config import auth_settings
from api.auth.dependencies import get_current_user, get_optional_user
from api.auth.jwt import clear_auth_cookie, create_access_token, set_auth_cookie
from api.auth.oauth import GoogleUserInfo, exchange_google_code

__all__ = [
    "auth_settings",
    "get_current_user",
    "get_optional_user",
    "create_access_token",
    "set_auth_cookie",
    "clear_auth_cookie",
    "exchange_google_code",
    "GoogleUserInfo",
]
