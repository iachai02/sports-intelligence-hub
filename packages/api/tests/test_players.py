"""Tests for player stats browser endpoints."""

from unittest.mock import patch

import pytest
from api.main import app
from draft_optimizer.schemas import PlayerProjection, Position
from fastapi.testclient import TestClient

client = TestClient(app)


def _create_mock_players() -> list[PlayerProjection]:
    """Create mock player data for testing."""
    return [
        PlayerProjection(
            id="nba_1",
            name="Nikola Jokic",
            team="DEN",
            position=Position.C,
            points=26.4,
            rebounds=12.4,
            assists=9.0,
            steals=1.4,
            blocks=0.9,
            turnovers=3.0,
            fg_pct=0.583,
            ft_pct=0.817,
            three_made=1.1,
            projected_fpts=62.5,
            auction_value=75.0,
        ),
        PlayerProjection(
            id="nba_2",
            name="Giannis Antetokounmpo",
            team="MIL",
            position=Position.PF,
            points=31.1,
            rebounds=11.9,
            assists=5.7,
            steals=1.1,
            blocks=1.4,
            turnovers=3.4,
            fg_pct=0.611,
            ft_pct=0.657,
            three_made=0.5,
            projected_fpts=58.0,
            auction_value=68.0,
        ),
        PlayerProjection(
            id="nba_3",
            name="Luka Doncic",
            team="DAL",
            position=Position.PG,
            points=33.9,
            rebounds=9.2,
            assists=9.8,
            steals=1.4,
            blocks=0.5,
            turnovers=4.0,
            fg_pct=0.487,
            ft_pct=0.786,
            three_made=3.5,
            projected_fpts=56.0,
            auction_value=65.0,
        ),
        PlayerProjection(
            id="nba_4",
            name="Stephen Curry",
            team="GSW",
            position=Position.PG,
            points=26.4,
            rebounds=4.5,
            assists=5.1,
            steals=0.9,
            blocks=0.4,
            turnovers=2.8,
            fg_pct=0.450,
            ft_pct=0.927,
            three_made=4.8,
            projected_fpts=45.0,
            auction_value=50.0,
        ),
        PlayerProjection(
            id="nba_5",
            name="LeBron James",
            team="LAL",
            position=Position.SF,
            points=25.7,
            rebounds=7.3,
            assists=8.3,
            steals=1.3,
            blocks=0.5,
            turnovers=3.5,
            fg_pct=0.540,
            ft_pct=0.750,
            three_made=2.1,
            projected_fpts=48.0,
            auction_value=52.0,
        ),
    ]


@pytest.fixture(autouse=True)
def mock_player_cache():
    """Mock the player cache for all tests."""
    mock_players = _create_mock_players()
    with patch("api.routers.players._get_cached_players", return_value=mock_players):
        yield mock_players


class TestGetPlayers:
    """Tests for GET /api/v1/players endpoint."""

    def test_get_players_default(self):
        """Test default player list returns paginated results."""
        response = client.get("/api/v1/players")
        assert response.status_code == 200
        data = response.json()

        assert "players" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert "total_pages" in data

        assert data["page"] == 1
        assert data["per_page"] == 50
        assert data["total"] == 5
        assert len(data["players"]) == 5

    def test_get_players_pagination(self):
        """Test pagination works correctly."""
        response = client.get("/api/v1/players?page=1&per_page=2")
        assert response.status_code == 200
        data = response.json()

        assert len(data["players"]) == 2
        assert data["total"] == 5
        assert data["total_pages"] == 3
        assert data["page"] == 1

    def test_get_players_search(self):
        """Test search filters by name."""
        response = client.get("/api/v1/players?search=jokic")
        assert response.status_code == 200
        data = response.json()

        assert len(data["players"]) == 1
        assert data["players"][0]["name"] == "Nikola Jokic"

    def test_get_players_filter_position(self):
        """Test filtering by position."""
        response = client.get("/api/v1/players?position=PG")
        assert response.status_code == 200
        data = response.json()

        assert len(data["players"]) == 2
        for player in data["players"]:
            assert player["position"] == "PG"

    def test_get_players_filter_team(self):
        """Test filtering by team."""
        response = client.get("/api/v1/players?team=DEN")
        assert response.status_code == 200
        data = response.json()

        assert len(data["players"]) == 1
        assert data["players"][0]["team"] == "DEN"

    def test_get_players_sort_by_ppg(self):
        """Test sorting by ppg descending."""
        response = client.get("/api/v1/players?sort_by=ppg&sort_order=desc")
        assert response.status_code == 200
        data = response.json()

        ppg_values = [p["ppg"] for p in data["players"]]
        assert ppg_values == sorted(ppg_values, reverse=True)

    def test_get_players_sort_ascending(self):
        """Test sorting in ascending order."""
        response = client.get("/api/v1/players?sort_by=auction_value&sort_order=asc")
        assert response.status_code == 200
        data = response.json()

        values = [p["auction_value"] for p in data["players"]]
        assert values == sorted(values)

    def test_get_players_invalid_position(self):
        """Test invalid position returns error."""
        response = client.get("/api/v1/players?position=INVALID")
        assert response.status_code == 400
        assert "Invalid position" in response.json()["detail"]


class TestGetPlayer:
    """Tests for GET /api/v1/players/{player_id} endpoint."""

    def test_get_player_found(self):
        """Test getting a specific player by ID."""
        response = client.get("/api/v1/players/nba_1")
        assert response.status_code == 200
        data = response.json()

        assert data["player_id"] == "nba_1"
        assert data["name"] == "Nikola Jokic"
        assert data["team"] == "DEN"
        assert data["position"] == "C"
        assert data["ppg"] == 26.4
        assert data["rpg"] == 12.4

    def test_get_player_not_found(self):
        """Test getting a non-existent player returns 404."""
        response = client.get("/api/v1/players/nba_999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]


class TestSearchPlayers:
    """Tests for GET /api/v1/players/search endpoint."""

    def test_search_players(self):
        """Test typeahead search."""
        response = client.get("/api/v1/players/search?q=ste")
        assert response.status_code == 200
        data = response.json()

        assert len(data) == 1
        assert data[0]["name"] == "Stephen Curry"

    def test_search_players_multiple(self):
        """Test search returning multiple results."""
        response = client.get("/api/v1/players/search?q=an")
        assert response.status_code == 200
        data = response.json()

        # Should match "Giannis Antetokounmpo"
        assert len(data) >= 1

    def test_search_players_limit(self):
        """Test search respects limit."""
        response = client.get("/api/v1/players/search?q=an&limit=2")
        assert response.status_code == 200
        data = response.json()

        assert len(data) <= 2

    def test_search_players_query_too_short(self):
        """Test search with query < 2 chars returns error."""
        response = client.get("/api/v1/players/search?q=a")
        assert response.status_code == 422  # Validation error


class TestGetTeams:
    """Tests for GET /api/v1/players/teams endpoint."""

    def test_get_teams(self):
        """Test getting list of teams."""
        response = client.get("/api/v1/players/teams")
        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, list)
        assert "DEN" in data
        assert "MIL" in data
        assert "DAL" in data
        # Teams should be sorted
        assert data == sorted(data)


class TestComparePlayers:
    """Tests for POST /api/v1/players/compare endpoint."""

    def test_compare_two_players(self):
        """Test comparing two players."""
        response = client.post(
            "/api/v1/players/compare",
            json={"player_ids": ["nba_1", "nba_2"]},
        )
        assert response.status_code == 200
        data = response.json()

        assert "players" in data
        assert len(data["players"]) == 2
        assert data["players"][0]["player_id"] == "nba_1"
        assert data["players"][1]["player_id"] == "nba_2"

    def test_compare_three_players(self):
        """Test comparing three players."""
        response = client.post(
            "/api/v1/players/compare",
            json={"player_ids": ["nba_1", "nba_2", "nba_3"]},
        )
        assert response.status_code == 200
        data = response.json()

        assert len(data["players"]) == 3

    def test_compare_player_not_found(self):
        """Test comparing with non-existent player returns error."""
        response = client.post(
            "/api/v1/players/compare",
            json={"player_ids": ["nba_1", "nba_999"]},
        )
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_compare_too_few_players(self):
        """Test comparing less than 2 players returns error."""
        response = client.post(
            "/api/v1/players/compare",
            json={"player_ids": ["nba_1"]},
        )
        assert response.status_code == 422  # Validation error

    def test_compare_too_many_players(self):
        """Test comparing more than 3 players returns error."""
        response = client.post(
            "/api/v1/players/compare",
            json={"player_ids": ["nba_1", "nba_2", "nba_3", "nba_4"]},
        )
        assert response.status_code == 422  # Validation error
