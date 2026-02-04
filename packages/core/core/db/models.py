"""SQLAlchemy ORM models."""

from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Base class for all models."""

    pass


class Player(Base):
    """NBA player."""

    __tablename__ = "players"

    id = Column(Integer, primary_key=True)
    nba_player_id = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    team = Column(String(50))
    position = Column(String(10))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stats = relationship("PlayerGameStats", back_populates="player")
    season_stats = relationship("PlayerSeasonStats", back_populates="player")


class Game(Base):
    """NBA game."""

    __tablename__ = "games"

    id = Column(Integer, primary_key=True)
    nba_game_id = Column(String(20), unique=True, nullable=False)
    season = Column(String(10), nullable=False)
    game_date = Column(Date, nullable=False)
    home_team = Column(String(50), nullable=False)
    away_team = Column(String(50), nullable=False)
    home_score = Column(Integer)
    away_score = Column(Integer)
    winner = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    stats = relationship("PlayerGameStats", back_populates="game")
    predictions = relationship("GamePrediction", back_populates="game")


class PlayerGameStats(Base):
    """Player statistics for a specific game."""

    __tablename__ = "player_game_stats"

    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"))
    game_id = Column(Integer, ForeignKey("games.id"))
    minutes = Column(Float)
    points = Column(Integer)
    rebounds = Column(Integer)
    assists = Column(Integer)
    steals = Column(Integer)
    blocks = Column(Integer)
    turnovers = Column(Integer)
    fg_pct = Column(Float)
    ft_pct = Column(Float)
    three_pct = Column(Float)
    fantasy_points = Column(Float)

    player = relationship("Player", back_populates="stats")
    game = relationship("Game", back_populates="stats")


class GamePrediction(Base):
    """Model prediction for a game."""

    __tablename__ = "game_predictions"

    id = Column(Integer, primary_key=True)
    game_id = Column(Integer, ForeignKey("games.id"))
    model_version = Column(String(50), nullable=False)
    predicted_winner = Column(String(50), nullable=False)
    win_probability = Column(Float, nullable=False)
    shap_values = Column(String)  # JSON stored as string
    created_at = Column(DateTime, default=datetime.utcnow)

    game = relationship("Game", back_populates="predictions")


class PlayerSeasonStats(Base):
    """Aggregated season stats for a player (used for ML training).

    Stores per-game averages for a player's season, including all 9 fantasy
    categories needed for projection models.
    """

    __tablename__ = "player_season_stats"

    id = Column(Integer, primary_key=True)
    player_id = Column(Integer, ForeignKey("players.id"))
    season = Column(String(10), nullable=False)  # e.g., "2024-25"

    # Games and minutes
    games_played = Column(Integer, default=0)
    minutes_per_game = Column(Float, default=0.0)

    # Per-game averages (9-category fantasy stats)
    ppg = Column(Float, default=0.0)  # Points per game
    rpg = Column(Float, default=0.0)  # Rebounds per game
    apg = Column(Float, default=0.0)  # Assists per game
    spg = Column(Float, default=0.0)  # Steals per game
    bpg = Column(Float, default=0.0)  # Blocks per game
    topg = Column(Float, default=0.0)  # Turnovers per game
    fg_pct = Column(Float, default=0.0)  # Field goal percentage
    ft_pct = Column(Float, default=0.0)  # Free throw percentage
    three_pm = Column(Float, default=0.0)  # Three pointers made per game

    # Additional useful stats
    three_pct = Column(Float, default=0.0)  # Three point percentage
    fga = Column(Float, default=0.0)  # Field goal attempts per game
    fta = Column(Float, default=0.0)  # Free throw attempts per game

    # Player metadata at time of season
    age = Column(Integer)
    team = Column(String(10))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    player = relationship("Player", back_populates="season_stats")
