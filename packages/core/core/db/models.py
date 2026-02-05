"""SQLAlchemy ORM models."""

from datetime import date, datetime
from typing import Any

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all models."""

    pass


class User(Base):
    """User account for authentication."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column()
    oauth_provider: Mapped[str] = mapped_column(String(20), default="google")
    oauth_id: Mapped[str] = mapped_column(String(100), nullable=False)
    preferences: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(insert_default=datetime.utcnow)
    last_login: Mapped[datetime | None] = mapped_column()

    __table_args__ = (UniqueConstraint("oauth_provider", "oauth_id"),)


class Player(Base):
    """NBA player."""

    __tablename__ = "players"

    id: Mapped[int] = mapped_column(primary_key=True)
    nba_player_id: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    team: Mapped[str | None] = mapped_column(String(50), default=None)
    position: Mapped[str | None] = mapped_column(String(10), default=None)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(insert_default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        insert_default=datetime.utcnow, onupdate=datetime.utcnow
    )

    stats: Mapped[list["PlayerGameStats"]] = relationship(back_populates="player")
    season_stats: Mapped[list["PlayerSeasonStats"]] = relationship(back_populates="player")


class Game(Base):
    """NBA game."""

    __tablename__ = "games"

    id: Mapped[int] = mapped_column(primary_key=True)
    nba_game_id: Mapped[str] = mapped_column(String(20), unique=True)
    season: Mapped[str] = mapped_column(String(10))
    game_date: Mapped[date] = mapped_column()
    home_team: Mapped[str] = mapped_column(String(50))
    away_team: Mapped[str] = mapped_column(String(50))
    home_score: Mapped[int | None] = mapped_column(default=None)
    away_score: Mapped[int | None] = mapped_column(default=None)
    winner: Mapped[str | None] = mapped_column(String(50), default=None)
    created_at: Mapped[datetime] = mapped_column(insert_default=datetime.utcnow)

    stats: Mapped[list["PlayerGameStats"]] = relationship(back_populates="game")
    predictions: Mapped[list["GamePrediction"]] = relationship(back_populates="game")


class PlayerGameStats(Base):
    """Player statistics for a specific game."""

    __tablename__ = "player_game_stats"

    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"), default=None)
    game_id: Mapped[int | None] = mapped_column(ForeignKey("games.id"), default=None)
    minutes: Mapped[float | None] = mapped_column(default=None)
    points: Mapped[int | None] = mapped_column(default=None)
    rebounds: Mapped[int | None] = mapped_column(default=None)
    assists: Mapped[int | None] = mapped_column(default=None)
    steals: Mapped[int | None] = mapped_column(default=None)
    blocks: Mapped[int | None] = mapped_column(default=None)
    turnovers: Mapped[int | None] = mapped_column(default=None)
    fg_pct: Mapped[float | None] = mapped_column(default=None)
    ft_pct: Mapped[float | None] = mapped_column(default=None)
    three_pct: Mapped[float | None] = mapped_column(default=None)
    fantasy_points: Mapped[float | None] = mapped_column(default=None)

    player: Mapped["Player"] = relationship(back_populates="stats")
    game: Mapped["Game"] = relationship(back_populates="stats")


class GamePrediction(Base):
    """Model prediction for a game."""

    __tablename__ = "game_predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int | None] = mapped_column(ForeignKey("games.id"), default=None)
    model_version: Mapped[str] = mapped_column(String(50))
    predicted_winner: Mapped[str] = mapped_column(String(50))
    win_probability: Mapped[float] = mapped_column()
    shap_values: Mapped[str | None] = mapped_column(default=None)  # JSON stored as string
    created_at: Mapped[datetime] = mapped_column(insert_default=datetime.utcnow)

    game: Mapped["Game"] = relationship(back_populates="predictions")


class PlayerSeasonStats(Base):
    """Aggregated season stats for a player (used for ML training).

    Stores per-game averages for a player's season, including all 9 fantasy
    categories needed for projection models.
    """

    __tablename__ = "player_season_stats"

    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"), default=None)
    season: Mapped[str] = mapped_column(String(10))  # e.g., "2024-25"

    # Games and minutes
    games_played: Mapped[int] = mapped_column(default=0)
    minutes_per_game: Mapped[float] = mapped_column(default=0.0)

    # Per-game averages (9-category fantasy stats)
    ppg: Mapped[float] = mapped_column(default=0.0)  # Points per game
    rpg: Mapped[float] = mapped_column(default=0.0)  # Rebounds per game
    apg: Mapped[float] = mapped_column(default=0.0)  # Assists per game
    spg: Mapped[float] = mapped_column(default=0.0)  # Steals per game
    bpg: Mapped[float] = mapped_column(default=0.0)  # Blocks per game
    topg: Mapped[float] = mapped_column(default=0.0)  # Turnovers per game
    fg_pct: Mapped[float] = mapped_column(default=0.0)  # Field goal percentage
    ft_pct: Mapped[float] = mapped_column(default=0.0)  # Free throw percentage
    three_pm: Mapped[float] = mapped_column(default=0.0)  # Three pointers made per game

    # Additional useful stats
    three_pct: Mapped[float] = mapped_column(default=0.0)  # Three point percentage
    fga: Mapped[float] = mapped_column(default=0.0)  # Field goal attempts per game
    fta: Mapped[float] = mapped_column(default=0.0)  # Free throw attempts per game

    # Player metadata at time of season
    age: Mapped[int | None] = mapped_column(default=None)
    team: Mapped[str | None] = mapped_column(String(10), default=None)

    created_at: Mapped[datetime] = mapped_column(insert_default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        insert_default=datetime.utcnow, onupdate=datetime.utcnow
    )

    player: Mapped["Player"] = relationship(back_populates="season_stats")
