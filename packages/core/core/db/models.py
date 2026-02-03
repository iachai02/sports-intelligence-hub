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
