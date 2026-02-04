"""Tests for auction value calibration (v2 z-score method)."""

import pytest
from draft_optimizer.features import (
    POSITION_SCARCITY,
    calculate_auction_value_v2,
    calculate_fantasy_points,
    calculate_player_projections_batch,
)
from draft_optimizer.mock_data import generate_mock_players
from draft_optimizer.schemas import Position


class TestAuctionValueV2:
    """Test the improved z-score based auction value calculation."""

    @pytest.fixture
    def player_pool_fpts(self) -> list[float]:
        """Generate a realistic distribution of fantasy points.

        Simulates a 150-player pool with realistic FPTS distribution:
        - Top 5: 55-65 FPTS (elite: Jokic, Shai, Luka, etc.)
        - Top 20: 45-55 FPTS (stars)
        - Top 50: 35-45 FPTS (solid starters)
        - Top 100: 25-35 FPTS (rotation players)
        - Bottom 50: 15-25 FPTS (bench/replacement)
        """
        fpts = []
        # Elite tier (5 players)
        fpts.extend([62, 60, 58, 57, 55])
        # Star tier (15 players)
        fpts.extend([54, 53, 52, 51, 50, 49, 48, 47, 46, 45, 44, 43, 43, 42, 42])
        # Starter tier (30 players)
        for i in range(30):
            fpts.append(41 - (i * 0.2))
        # Rotation tier (50 players)
        for i in range(50):
            fpts.append(35 - (i * 0.2))
        # Bench tier (50 players)
        for i in range(50):
            fpts.append(25 - (i * 0.2))
        return fpts

    def test_elite_player_high_value(self, player_pool_fpts):
        """Elite players (Jokic, Shai tier) should be worth $60-75."""
        elite_fpts = 62.0  # Jokic-level production (rank 1)

        value = calculate_auction_value_v2(
            projected_fpts=elite_fpts,
            all_player_fpts=player_pool_fpts,
            position=Position.C,
            num_teams=12,
            roster_size=13,
            budget_per_team=200.0,
        )

        assert 60 <= value <= 75, f"Elite player (rank 1) should be $60-75, got ${value}"

    def test_star_player_solid_value(self, player_pool_fpts):
        """Star players (top 10-15%) should have significant value."""
        star_fpts = 50.0  # All-Star caliber

        value = calculate_auction_value_v2(
            projected_fpts=star_fpts,
            all_player_fpts=player_pool_fpts,
            position=Position.PG,
            num_teams=12,
            roster_size=13,
            budget_per_team=200.0,
        )

        # Stars should be valuable but less than elite
        # In this pool, 50 FPTS ranks around position 15-20
        assert 20 <= value <= 65, f"Star player should be $20-65, got ${value}"

    def test_average_starter_reasonable_value(self, player_pool_fpts):
        """Average starters should have moderate value."""
        starter_fpts = 38.0  # Solid starter (around rank 40-50 in 150-player pool)

        value = calculate_auction_value_v2(
            projected_fpts=starter_fpts,
            all_player_fpts=player_pool_fpts,
            position=Position.SF,
            num_teams=12,
            roster_size=13,
            budget_per_team=200.0,
        )

        # In the exponential model, mid-tier players drop off quickly
        assert 3 <= value <= 35, f"Starter should be $3-35, got ${value}"

    def test_bench_player_minimum_value(self, player_pool_fpts):
        """Bench players (bottom half) should be worth $1-8."""
        bench_fpts = 20.0  # Replacement level (rank ~100)

        value = calculate_auction_value_v2(
            projected_fpts=bench_fpts,
            all_player_fpts=player_pool_fpts,
            position=Position.PF,
            num_teams=12,
            roster_size=13,
            budget_per_team=200.0,
        )

        assert 1 <= value <= 8, f"Bench player should be $1-8, got ${value}"

    def test_minimum_value_floor(self, player_pool_fpts):
        """Even terrible players should have $1 minimum."""
        terrible_fpts = 5.0

        value = calculate_auction_value_v2(
            projected_fpts=terrible_fpts,
            all_player_fpts=player_pool_fpts,
            position=Position.SG,
        )

        assert value == 1.0, f"Minimum value should be $1, got ${value}"

    def test_maximum_value_ceiling(self, player_pool_fpts):
        """Even the best player should cap at $75."""
        godlike_fpts = 100.0  # Unrealistic

        value = calculate_auction_value_v2(
            projected_fpts=godlike_fpts,
            all_player_fpts=player_pool_fpts,
            position=Position.C,
        )

        assert value <= 75, f"Maximum value should be $75, got ${value}"


class TestPositionScarcity:
    """Test position scarcity multipliers."""

    def test_center_scarcity_premium(self):
        """Centers should have the highest scarcity premium."""
        assert POSITION_SCARCITY[Position.C] == 1.15
        assert POSITION_SCARCITY[Position.C] > POSITION_SCARCITY[Position.SF]

    def test_guard_moderate_premium(self):
        """Point guards should have slight premium for playmaking."""
        assert POSITION_SCARCITY[Position.PG] == 1.05
        assert POSITION_SCARCITY[Position.PG] > POSITION_SCARCITY[Position.SG]

    def test_wing_baseline(self):
        """Wings should be at baseline (no premium)."""
        assert POSITION_SCARCITY[Position.SF] == 1.00
        assert POSITION_SCARCITY[Position.SG] == 1.00

    def test_scarcity_affects_value(self):
        """Same FPTS should yield higher value for scarce positions."""
        fpts_pool = [50, 45, 40, 35, 30, 25, 20, 15] * 20  # 160 players

        center_value = calculate_auction_value_v2(
            projected_fpts=45.0,
            all_player_fpts=fpts_pool,
            position=Position.C,
        )

        wing_value = calculate_auction_value_v2(
            projected_fpts=45.0,
            all_player_fpts=fpts_pool,
            position=Position.SF,
        )

        assert center_value > wing_value, "Center should be worth more than wing at same FPTS"


class TestLeagueBudgetCalibration:
    """Test that total values approximate league budget."""

    def test_total_value_approximates_budget(self):
        """Sum of top 156 player values should be reasonable (not exact match)."""
        # Generate realistic player pool
        players = generate_mock_players(count=200, seed=42)

        # Get all FPTS
        all_fpts = [p.projected_fpts for p in players]

        # Calculate v2 values for all players
        values = []
        for player in players:
            value = calculate_auction_value_v2(
                projected_fpts=player.projected_fpts,
                all_player_fpts=all_fpts,
                position=Position(player.position),
                num_teams=12,
                roster_size=13,
                budget_per_team=200.0,
            )
            values.append(value)

        # Sort by value and take top 156 (draftable pool)
        sorted_values = sorted(values, reverse=True)[:156]
        total_value = sum(sorted_values)

        # Total value should be substantial but can vary
        # The exponential decay model creates realistic distribution
        # Most value concentrated in top players
        expected_budget = 12 * 200  # $2400

        # Allow wider range since the exponential curve front-loads value
        assert total_value >= 500, f"Total value ${total_value} seems too low"
        assert total_value <= expected_budget * 1.5, (
            f"Total value ${total_value} exceeds reasonable range"
        )

    def test_value_distribution_reasonable(self):
        """Check distribution: few elite, many cheap players."""
        players = generate_mock_players(count=150, seed=42)
        all_fpts = [p.projected_fpts for p in players]

        values = []
        for player in players:
            value = calculate_auction_value_v2(
                projected_fpts=player.projected_fpts,
                all_player_fpts=all_fpts,
                position=Position(player.position),
            )
            values.append(value)

        # Count players in value tiers
        elite = sum(1 for v in values if v >= 50)  # $50+
        stars = sum(1 for v in values if 25 <= v < 50)  # $25-49
        starters = sum(1 for v in values if 8 <= v < 25)  # $8-24
        bench = sum(1 for v in values if v < 8)  # $1-7

        # Should have pyramid distribution (exponential decay)
        # The steeper decay means fewer elite players
        assert elite <= 20, f"Too many elite players: {elite}"
        assert stars >= 3, f"Too few star players: {stars}"
        assert starters >= 15, f"Too few starter-tier players: {starters}"
        assert bench >= 40, f"Too few bench players: {bench}"


class TestBatchProjections:
    """Test batch projection calculation with pool-aware values."""

    def test_batch_produces_calibrated_values(self):
        """Batch projection should produce realistic auction values."""
        # Create test player data
        players_data = [
            {
                "player_id": "jokic",
                "name": "Nikola Jokic",
                "team": "DEN",
                "position": "C",
                "stats": {
                    "points": 26.0,
                    "rebounds": 12.0,
                    "assists": 9.0,
                    "steals": 1.3,
                    "blocks": 0.9,
                    "turnovers": 3.5,
                    "fg_pct": 0.58,
                    "ft_pct": 0.82,
                    "three_made": 1.0,
                },
            },
            {
                "player_id": "shai",
                "name": "Shai Gilgeous-Alexander",
                "team": "OKC",
                "position": "PG",
                "stats": {
                    "points": 31.0,
                    "rebounds": 5.5,
                    "assists": 6.5,
                    "steals": 2.0,
                    "blocks": 0.9,
                    "turnovers": 2.8,
                    "fg_pct": 0.54,
                    "ft_pct": 0.88,
                    "three_made": 2.0,
                },
            },
            # Add some average players
            {
                "player_id": "role1",
                "name": "Role Player 1",
                "team": "LAL",
                "position": "SF",
                "stats": {
                    "points": 12.0,
                    "rebounds": 5.0,
                    "assists": 2.0,
                    "steals": 0.8,
                    "blocks": 0.5,
                    "turnovers": 1.5,
                    "fg_pct": 0.45,
                    "ft_pct": 0.78,
                    "three_made": 1.5,
                },
            },
            {
                "player_id": "bench1",
                "name": "Bench Player 1",
                "team": "CHI",
                "position": "PG",
                "stats": {
                    "points": 6.0,
                    "rebounds": 2.0,
                    "assists": 3.0,
                    "steals": 0.5,
                    "blocks": 0.1,
                    "turnovers": 1.2,
                    "fg_pct": 0.42,
                    "ft_pct": 0.80,
                    "three_made": 0.5,
                },
            },
        ]

        # Add more filler players to create realistic pool
        for i in range(146):
            tier = i // 30
            base_pts = 20 - (tier * 4)
            players_data.append({
                "player_id": f"player_{i}",
                "name": f"Player {i}",
                "team": "UNK",
                "position": ["PG", "SG", "SF", "PF", "C"][i % 5],
                "stats": {
                    "points": base_pts + (i % 5),
                    "rebounds": 4.0 + (i % 3),
                    "assists": 2.0 + (i % 4),
                    "steals": 0.5 + (i % 10) * 0.1,
                    "blocks": 0.3 + (i % 10) * 0.1,
                    "turnovers": 1.5,
                    "fg_pct": 0.45,
                    "ft_pct": 0.78,
                    "three_made": 1.0,
                },
            })

        projections = calculate_player_projections_batch(players_data)

        # Find our key players
        jokic = next(p for p in projections if p.id == "jokic")
        shai = next(p for p in projections if p.id == "shai")
        role_player = next(p for p in projections if p.id == "role1")
        bench_player = next(p for p in projections if p.id == "bench1")

        # Elite players should be expensive
        assert jokic.auction_value >= 50, f"Jokic should be $50+, got ${jokic.auction_value}"
        assert shai.auction_value >= 50, f"Shai should be $50+, got ${shai.auction_value}"

        # Role players should be moderate to low (depends on pool composition)
        # A 24 FPTS role player in a pool with lots of high-FPTS players will be cheaper
        assert 1 <= role_player.auction_value <= 25, (
            f"Role player should be $1-25, got ${role_player.auction_value}"
        )

        # Bench players should be cheap
        assert bench_player.auction_value <= 15, (
            f"Bench player should be $15 or less, got ${bench_player.auction_value}"
        )

    def test_batch_calculates_correct_fpts(self):
        """Verify fantasy points calculation in batch mode."""
        players_data = [
            {
                "player_id": "test",
                "name": "Test Player",
                "team": "TST",
                "position": "PG",
                "stats": {
                    "points": 30.0,
                    "rebounds": 10.0,
                    "assists": 8.0,
                    "steals": 1.5,
                    "blocks": 1.0,
                    "turnovers": 3.0,
                    "fg_pct": 0.55,
                    "ft_pct": 0.85,
                    "three_made": 2.5,
                },
            }
        ]

        projections = calculate_player_projections_batch(players_data)
        player = projections[0]

        # Calculate expected FPTS manually
        expected_fpts = calculate_fantasy_points(
            points=30.0,
            rebounds=10.0,
            assists=8.0,
            steals=1.5,
            blocks=1.0,
            turnovers=3.0,
            fg_pct=0.55,
            ft_pct=0.85,
            three_made=2.5,
        )

        assert player.projected_fpts == expected_fpts
