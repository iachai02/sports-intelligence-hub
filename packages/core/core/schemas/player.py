"""Player data schemas."""

from pydantic import BaseModel, ConfigDict


class PlayerSchema(BaseModel):
    """Schema for NBA player data."""

    model_config = ConfigDict(from_attributes=True)

    nba_player_id: str
    name: str
    team: str | None = None
    position: str | None = None
    is_active: bool = True
