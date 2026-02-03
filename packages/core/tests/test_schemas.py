"""Tests for core schemas."""

from datetime import date

import pytest

from core.schemas import GameSchema, PlayerSchema


class TestPlayerSchema:
    """Tests for PlayerSchema."""

    def test_create_player_minimal(self):
        """Test creating a player with minimal fields."""
        player = PlayerSchema(
            nba_player_id="12345",
            name="LeBron James",
        )
        assert player.nba_player_id == "12345"
        assert player.name == "LeBron James"
        assert player.is_active is True
        assert player.team is None

    def test_create_player_full(self):
        """Test creating a player with all fields."""
        player = PlayerSchema(
            nba_player_id="12345",
            name="LeBron James",
            team="Los Angeles Lakers",
            position="SF",
            is_active=True,
        )
        assert player.team == "Los Angeles Lakers"
        assert player.position == "SF"


class TestGameSchema:
    """Tests for GameSchema."""

    def test_create_game_upcoming(self):
        """Test creating an upcoming game (no scores)."""
        game = GameSchema(
            nba_game_id="0022400123",
            season="2024-25",
            game_date=date(2025, 1, 15),
            home_team="Los Angeles Lakers",
            away_team="Boston Celtics",
        )
        assert game.home_score is None
        assert game.winner is None

    def test_create_game_completed(self):
        """Test creating a completed game."""
        game = GameSchema(
            nba_game_id="0022400123",
            season="2024-25",
            game_date=date(2025, 1, 15),
            home_team="Los Angeles Lakers",
            away_team="Boston Celtics",
            home_score=112,
            away_score=108,
            winner="Los Angeles Lakers",
        )
        assert game.home_score == 112
        assert game.winner == "Los Angeles Lakers"
