"""Tests for the draft optimizer."""

import pytest
from draft_optimizer.features import calculate_auction_value, calculate_fantasy_points
from draft_optimizer.mock_data import generate_mock_player, generate_mock_players
from draft_optimizer.optimizer import DraftOptimizer, optimize_draft
from draft_optimizer.schemas import (
    OptimizationRequest,
    PlayerProjection,
    Position,
    RosterConfig,
    RosterSlot,
)


class TestFantasyPointsCalculation:
    """Test fantasy points scoring."""

    def test_elite_player_scores_high(self):
        """Elite stats should produce high fantasy points."""
        fpts = calculate_fantasy_points(
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
        # Elite triple-double threat should score 50+ FPTS
        assert fpts > 50, f"Elite player should score 50+ FPTS, got {fpts}"

    def test_bench_player_scores_low(self):
        """Bench-level stats should produce low fantasy points."""
        fpts = calculate_fantasy_points(
            points=5.0,
            rebounds=2.0,
            assists=1.0,
            steals=0.3,
            blocks=0.2,
            turnovers=0.8,
            fg_pct=0.42,
            ft_pct=0.70,
            three_made=0.3,
        )
        # Bench player should score under 20 FPTS
        assert fpts < 20, f"Bench player should score under 20 FPTS, got {fpts}"

    def test_turnovers_reduce_score(self):
        """High turnovers should significantly reduce fantasy points."""
        fpts_low_to = calculate_fantasy_points(
            points=20.0, rebounds=5.0, assists=5.0, steals=1.0, blocks=0.5,
            turnovers=1.0, fg_pct=0.45, ft_pct=0.80, three_made=1.5,
        )
        fpts_high_to = calculate_fantasy_points(
            points=20.0, rebounds=5.0, assists=5.0, steals=1.0, blocks=0.5,
            turnovers=5.0, fg_pct=0.45, ft_pct=0.80, three_made=1.5,
        )
        assert fpts_low_to > fpts_high_to + 3, "High TO player should score significantly less"


class TestAuctionValue:
    """Test auction value calculation."""

    def test_elite_player_high_value(self):
        """Elite players should have high auction value."""
        value = calculate_auction_value(projected_fpts=55.0)
        assert value >= 40, f"Elite player should be worth $40+, got ${value}"

    def test_replacement_level_minimum(self):
        """Replacement level players should have minimum value."""
        value = calculate_auction_value(projected_fpts=25.0)
        assert value == 1, f"Replacement player should be $1, got ${value}"

    def test_value_increases_with_fpts(self):
        """Higher projected points should mean higher value."""
        value_low = calculate_auction_value(projected_fpts=30.0)
        value_high = calculate_auction_value(projected_fpts=45.0)
        assert value_high > value_low, "Better player should have higher value"


class TestMockDataGeneration:
    """Test mock player generation."""

    def test_generates_correct_count(self):
        """Should generate requested number of players."""
        players = generate_mock_players(100, seed=42)
        assert len(players) == 100

    def test_all_positions_represented(self):
        """Should include all 5 positions."""
        players = generate_mock_players(150, seed=42)
        positions = {p.position for p in players}
        assert positions == {"PG", "SG", "SF", "PF", "C"}

    def test_reproducible_with_seed(self):
        """Same seed should produce same players."""
        players1 = generate_mock_players(50, seed=123)
        players2 = generate_mock_players(50, seed=123)
        assert [p.id for p in players1] == [p.id for p in players2]
        assert [p.projected_fpts for p in players1] == [p.projected_fpts for p in players2]

    def test_single_player_generation(self):
        """Should generate a single player of specified type."""
        player = generate_mock_player(Position.C, tier="elite", seed=42)
        assert player.position == "C"
        assert player.projected_fpts > 35  # Elite center should be productive


class TestDraftOptimizer:
    """Test the core optimization logic."""

    @pytest.fixture
    def player_pool(self) -> list[PlayerProjection]:
        """Generate a standard player pool for testing."""
        return generate_mock_players(150, seed=42)

    def test_solves_successfully(self, player_pool):
        """Optimizer should find a valid solution."""
        result = optimize_draft(player_pool)
        assert result.status == "Optimal"

    def test_fills_all_roster_slots(self, player_pool):
        """Should fill exactly 13 roster spots."""
        result = optimize_draft(player_pool)
        assert len(result.roster) == 13, f"Expected 13 players, got {len(result.roster)}"

    def test_respects_budget(self, player_pool):
        """Total cost should not exceed budget."""
        result = optimize_draft(player_pool)
        assert result.total_cost <= 200, f"Cost ${result.total_cost} exceeds $200 budget"

    def test_budget_remaining_accurate(self, player_pool):
        """Budget remaining should equal budget minus cost."""
        result = optimize_draft(player_pool)
        expected_remaining = 200 - result.total_cost
        assert abs(result.budget_remaining - expected_remaining) < 0.01

    def test_no_duplicate_players(self, player_pool):
        """Each player should appear at most once."""
        result = optimize_draft(player_pool)
        player_ids = [sp.player.id for sp in result.roster]
        assert len(player_ids) == len(set(player_ids)), "Duplicate player selected"

    def test_position_eligibility(self, player_pool):
        """Players should only fill slots they're eligible for."""
        result = optimize_draft(player_pool)

        for sp in result.roster:
            player_pos = Position(sp.player.position)
            slot = sp.slot

            # Check eligibility based on slot type
            if slot == RosterSlot.PG:
                assert player_pos == Position.PG
            elif slot == RosterSlot.SG:
                assert player_pos == Position.SG
            elif slot == RosterSlot.G:
                assert player_pos in {Position.PG, Position.SG}
            elif slot == RosterSlot.SF:
                assert player_pos == Position.SF
            elif slot == RosterSlot.PF:
                assert player_pos == Position.PF
            elif slot == RosterSlot.F:
                assert player_pos in {Position.SF, Position.PF}
            elif slot == RosterSlot.C:
                assert player_pos == Position.C
            # UTIL and BENCH can be any position

    def test_starters_vs_bench_count(self, player_pool):
        """Should have 10 starters and 3 bench."""
        result = optimize_draft(player_pool)
        starters = [sp for sp in result.roster if sp.is_starter]
        bench = [sp for sp in result.roster if not sp.is_starter]
        assert len(starters) == 10, f"Expected 10 starters, got {len(starters)}"
        assert len(bench) == 3, f"Expected 3 bench, got {len(bench)}"

    def test_excluded_players_not_selected(self, player_pool):
        """Excluded players should not appear in roster."""
        # Exclude first 5 players
        excluded = [p.id for p in player_pool[:5]]
        result = optimize_draft(player_pool, excluded_ids=excluded)

        selected_ids = {sp.player.id for sp in result.roster}
        assert not selected_ids.intersection(excluded), "Excluded player was selected"

    def test_locked_players_included(self, player_pool):
        """Locked players must be in the roster."""
        # Find a cheap player to lock (so budget isn't an issue)
        cheap_players = sorted(player_pool, key=lambda p: p.auction_value)[:3]
        locked = [p.id for p in cheap_players]

        result = optimize_draft(player_pool, locked_ids=locked)

        selected_ids = {sp.player.id for sp in result.roster}
        for locked_id in locked:
            assert locked_id in selected_ids, f"Locked player {locked_id} not selected"


class TestCustomRosterConfig:
    """Test custom roster configurations."""

    @pytest.fixture
    def player_pool(self) -> list[PlayerProjection]:
        return generate_mock_players(150, seed=42)

    def test_custom_two_centers(self, player_pool):
        """Should allow 2 centers and 2 UTIL instead of 1C/3UTIL."""
        custom_config = RosterConfig(
            slots=[
                RosterSlot.PG,
                RosterSlot.SG,
                RosterSlot.G,
                RosterSlot.SF,
                RosterSlot.PF,
                RosterSlot.F,
                RosterSlot.C,
                RosterSlot.C,  # Second center
                RosterSlot.UTIL,
                RosterSlot.UTIL,  # Only 2 UTIL now
                RosterSlot.BENCH,
                RosterSlot.BENCH,
                RosterSlot.BENCH,
            ],
            budget=200.0,
        )

        result = optimize_draft(player_pool, config=custom_config)

        assert result.status == "Optimal"
        assert len(result.roster) == 13

        # Count centers in starting lineup
        centers = [
            sp for sp in result.roster
            if sp.slot == RosterSlot.C and sp.is_starter
        ]
        assert len(centers) == 2, f"Expected 2 starting centers, got {len(centers)}"

    def test_smaller_budget(self, player_pool):
        """Should work with smaller budget (forces cheaper players)."""
        cheap_config = RosterConfig(budget=100.0)

        result = optimize_draft(player_pool, config=cheap_config)

        assert result.status == "Optimal"
        assert result.total_cost <= 100

    def test_from_request(self, player_pool):
        """Should work via OptimizationRequest."""
        request = OptimizationRequest(
            players=player_pool,
            config=RosterConfig(budget=180.0),
            excluded_player_ids=[player_pool[0].id],
        )

        optimizer = DraftOptimizer.from_request(request)
        result = optimizer.solve()

        assert result.status == "Optimal"
        assert result.total_cost <= 180
        assert player_pool[0].id not in {sp.player.id for sp in result.roster}
