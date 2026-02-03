"""Tests for database connection and models."""

import os

import pytest
from core.db import get_db_url
from core.db.models import Base, Game, Player
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session


@pytest.fixture
def test_engine():
    """Create a test database engine."""
    # Use environment variable or default to local Docker DB
    url = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/sports_hub")
    engine = create_engine(url)
    # Create tables
    Base.metadata.create_all(engine)
    yield engine


@pytest.fixture
def db_session(test_engine):
    """Create a database session for testing."""
    with Session(test_engine) as session:
        yield session
        session.rollback()  # Roll back any changes after test


class TestDatabaseConnection:
    """Tests for database connectivity."""

    def test_get_db_url_returns_string(self):
        """Test that get_db_url returns a valid URL string."""
        url = get_db_url()
        assert isinstance(url, str)
        assert "postgresql" in url

    def test_can_connect_to_database(self, test_engine):
        """Test that we can connect and execute a query."""
        with test_engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            assert result.fetchone() == (1,)


class TestPlayerModel:
    """Tests for Player ORM model."""

    def test_create_player(self, db_session):
        """Test creating a player in the database."""
        player = Player(
            nba_player_id="test_12345",
            name="Test Player",
            team="Test Team",
            position="PG",
        )
        db_session.add(player)
        db_session.flush()

        assert player.id is not None
        assert player.is_active is True

    def test_query_player(self, db_session):
        """Test querying players."""
        # Create a player
        player = Player(
            nba_player_id="test_67890",
            name="Query Test Player",
        )
        db_session.add(player)
        db_session.flush()

        # Query it back
        found = db_session.query(Player).filter_by(nba_player_id="test_67890").first()
        assert found is not None
        assert found.name == "Query Test Player"


class TestGameModel:
    """Tests for Game ORM model."""

    def test_create_game(self, db_session):
        """Test creating a game in the database."""
        from datetime import date

        game = Game(
            nba_game_id="test_0022400001",
            season="2024-25",
            game_date=date(2024, 10, 22),
            home_team="Los Angeles Lakers",
            away_team="Boston Celtics",
        )
        db_session.add(game)
        db_session.flush()

        assert game.id is not None
        assert game.winner is None  # Game not yet played
