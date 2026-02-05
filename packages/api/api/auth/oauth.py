"""Google OAuth integration."""

from dataclasses import dataclass

import httpx

from api.auth.config import auth_settings


@dataclass
class GoogleUserInfo:
    """User info returned from Google."""

    id: str
    email: str
    name: str | None
    picture: str | None


class OAuthError(Exception):
    """OAuth exchange failed."""

    pass


async def exchange_google_code(
    code: str, redirect_uri: str, code_verifier: str | None = None
) -> GoogleUserInfo:
    """Exchange authorization code for tokens and fetch user info.

    Args:
        code: Authorization code from Google
        redirect_uri: The redirect URI used in the authorization request
        code_verifier: PKCE code verifier (optional but recommended)

    Returns:
        GoogleUserInfo with user details

    Raises:
        OAuthError: If token exchange or userinfo fetch fails
    """
    # Exchange code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "client_id": auth_settings.google_client_id,
        "client_secret": auth_settings.google_client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }

    if code_verifier:
        token_data["code_verifier"] = code_verifier

    async with httpx.AsyncClient() as client:
        # Get tokens
        token_response = await client.post(token_url, data=token_data)
        if token_response.status_code != 200:
            error_detail = token_response.json().get("error_description", "Token exchange failed")
            raise OAuthError(f"Failed to exchange code: {error_detail}")

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        if not access_token:
            raise OAuthError("No access token in response")

        # Fetch user info
        userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
        userinfo_response = await client.get(
            userinfo_url, headers={"Authorization": f"Bearer {access_token}"}
        )

        if userinfo_response.status_code != 200:
            raise OAuthError("Failed to fetch user info")

        userinfo = userinfo_response.json()

        return GoogleUserInfo(
            id=userinfo.get("id", ""),
            email=userinfo.get("email", ""),
            name=userinfo.get("name"),
            picture=userinfo.get("picture"),
        )
