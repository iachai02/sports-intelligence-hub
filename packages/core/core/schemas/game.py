"""Game data schemas."""

from datetime import date

from pydantic import BaseModel, ConfigDict


class GameSchema(BaseModel):
    """Schema for NBA game data."""

    model_config = ConfigDict(from_attributes=True)

    nba_game_id: str
    season: str  # e.g., "2024-25"
    game_date: date
    home_team: str
    away_team: str
    home_score: int | None = None
    away_score: int | None = None
    winner: str | None = None
