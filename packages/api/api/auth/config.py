"""Authentication configuration."""

import os
from dataclasses import dataclass


@dataclass
class AuthSettings:
    """Authentication settings loaded from environment."""

    google_client_id: str
    google_client_secret: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    token_expire_minutes: int = 60
    cookie_name: str = "sports_hub_token"
    cookie_secure: bool = False  # Set True in production with HTTPS
    cookie_samesite: str = "lax"

    @classmethod
    def from_env(cls) -> "AuthSettings":
        """Load settings from environment variables."""
        return cls(
            google_client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
            google_client_secret=os.getenv("GOOGLE_CLIENT_SECRET", ""),
            jwt_secret=os.getenv("JWT_SECRET", "dev-secret-change-in-production"),
        )


auth_settings = AuthSettings.from_env()
