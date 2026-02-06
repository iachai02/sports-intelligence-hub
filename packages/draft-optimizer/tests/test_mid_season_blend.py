"""Tests for mid-season blending in projection_service.

Covers:
- Weight formula correctness
- 0-game pure projection (no blending)
- 50+ game 85% current weight
- Intermediate blending values between bounds
- All stats are blended
"""

import pytest
from draft_optimizer.ml.features import STAT_TARGETS
from draft_optimizer.projection_service import blend_mid_season

# Sample predictions and actuals for testing
XGB_PREDS = {
    "ppg": 20.0,
    "rpg": 8.0,
    "apg": 5.0,
    "spg": 1.0,
    "bpg": 1.5,
    "topg": 2.0,
    "fg_pct": 0.450,
    "ft_pct": 0.800,
    "three_pm": 2.0,
}

CURRENT_ACTUALS = {
    "ppg": 25.0,
    "rpg": 10.0,
    "apg": 6.0,
    "spg": 1.5,
    "bpg": 3.5,
    "topg": 2.5,
    "fg_pct": 0.500,
    "ft_pct": 0.850,
    "three_pm": 2.5,
}


class TestBlendWeightFormula:
    """Test the weight formula: weight = min(0.85, games_played / 50)."""

    def test_zero_games_pure_projection(self):
        """With 0 games played, should return pure XGBoost projection."""
        result = blend_mid_season(XGB_PREDS, CURRENT_ACTUALS, games_played=0)

        for stat in STAT_TARGETS:
            assert result[stat] == pytest.approx(XGB_PREDS[stat], abs=0.001), (
                f"{stat}: expected {XGB_PREDS[stat]}, got {result[stat]}"
            )

    def test_10_games_20_percent_current(self):
        """With 10 games: current_weight = 10/50 = 0.20."""
        result = blend_mid_season(XGB_PREDS, CURRENT_ACTUALS, games_played=10)

        for stat in STAT_TARGETS:
            expected = 0.20 * CURRENT_ACTUALS[stat] + 0.80 * XGB_PREDS[stat]
            assert result[stat] == pytest.approx(expected, abs=0.001), (
                f"{stat}: expected {expected}, got {result[stat]}"
            )

    def test_25_games_50_percent_current(self):
        """With 25 games: current_weight = 25/50 = 0.50."""
        result = blend_mid_season(XGB_PREDS, CURRENT_ACTUALS, games_played=25)

        for stat in STAT_TARGETS:
            expected = 0.50 * CURRENT_ACTUALS[stat] + 0.50 * XGB_PREDS[stat]
            assert result[stat] == pytest.approx(expected, abs=0.001), (
                f"{stat}: expected {expected}, got {result[stat]}"
            )

    def test_40_games_80_percent_current(self):
        """With 40 games: current_weight = 40/50 = 0.80."""
        result = blend_mid_season(XGB_PREDS, CURRENT_ACTUALS, games_played=40)

        for stat in STAT_TARGETS:
            expected = 0.80 * CURRENT_ACTUALS[stat] + 0.20 * XGB_PREDS[stat]
            assert result[stat] == pytest.approx(expected, abs=0.001), (
                f"{stat}: expected {expected}, got {result[stat]}"
            )

    def test_50_games_capped_at_85_percent(self):
        """With 50 games: current_weight = min(0.85, 50/50) = min(0.85, 1.0) = 0.85."""
        result = blend_mid_season(XGB_PREDS, CURRENT_ACTUALS, games_played=50)

        for stat in STAT_TARGETS:
            expected = 0.85 * CURRENT_ACTUALS[stat] + 0.15 * XGB_PREDS[stat]
            assert result[stat] == pytest.approx(expected, abs=0.001), (
                f"{stat}: expected {expected}, got {result[stat]}"
            )

    def test_82_games_still_capped_at_85(self):
        """With 82 games (full season): still capped at 85%."""
        result = blend_mid_season(XGB_PREDS, CURRENT_ACTUALS, games_played=82)

        for stat in STAT_TARGETS:
            expected = 0.85 * CURRENT_ACTUALS[stat] + 0.15 * XGB_PREDS[stat]
            assert result[stat] == pytest.approx(expected, abs=0.001), (
                f"{stat}: expected {expected}, got {result[stat]}"
            )


class TestBlendedValuesBounds:
    """Test that blended values are between projection and actuals."""

    def test_blended_between_bounds(self):
        """Blended values should always be between XGBoost and actuals."""
        for games in [5, 10, 20, 30, 40, 50, 60, 70, 82]:
            result = blend_mid_season(XGB_PREDS, CURRENT_ACTUALS, games_played=games)

            for stat in STAT_TARGETS:
                low = min(XGB_PREDS[stat], CURRENT_ACTUALS[stat])
                high = max(XGB_PREDS[stat], CURRENT_ACTUALS[stat])
                assert low - 0.001 <= result[stat] <= high + 0.001, (
                    f"games={games}, {stat}: {result[stat]} not in [{low}, {high}]"
                )

    def test_blended_equals_actual_when_same(self):
        """When projection equals actuals, blend should equal both."""
        same_actuals = XGB_PREDS.copy()
        result = blend_mid_season(XGB_PREDS, same_actuals, games_played=30)

        for stat in STAT_TARGETS:
            assert result[stat] == pytest.approx(XGB_PREDS[stat], abs=0.001)


class TestBlendAllStats:
    """Test that all 9 stat categories are blended."""

    def test_all_stats_present(self):
        """Result should contain all 9 stat targets."""
        result = blend_mid_season(XGB_PREDS, CURRENT_ACTUALS, games_played=25)
        assert set(result.keys()) == set(STAT_TARGETS)

    def test_percentages_handled(self):
        """FG% and FT% should blend correctly (not clamped incorrectly)."""
        result = blend_mid_season(XGB_PREDS, CURRENT_ACTUALS, games_played=25)

        # 50% blend: 0.5*0.500 + 0.5*0.450 = 0.475
        assert result["fg_pct"] == pytest.approx(0.475, abs=0.001)
        # 50% blend: 0.5*0.850 + 0.5*0.800 = 0.825
        assert result["ft_pct"] == pytest.approx(0.825, abs=0.001)


class TestBlendSpecificScenarios:
    """Test specific player scenarios."""

    def test_wembanyama_bpg_scenario(self):
        """Wembanyama-like: XGBoost predicts 1.5 BPG, actual is 3.6.

        Mid-season blending should pull the projection closer to reality.
        """
        xgb = {"ppg": 22.0, "rpg": 10.0, "apg": 3.5, "spg": 1.0, "bpg": 1.5,
               "topg": 3.0, "fg_pct": 0.47, "ft_pct": 0.79, "three_pm": 0.8}
        actual = {"ppg": 24.0, "rpg": 11.0, "apg": 3.8, "spg": 1.2, "bpg": 3.6,
                  "topg": 2.8, "fg_pct": 0.48, "ft_pct": 0.80, "three_pm": 1.0}

        # After 30 games: weight = 30/50 = 0.60
        result = blend_mid_season(xgb, actual, games_played=30)
        expected_bpg = 0.60 * 3.6 + 0.40 * 1.5  # = 2.76
        assert result["bpg"] == pytest.approx(expected_bpg, abs=0.001)
        assert result["bpg"] > 2.0  # Much better than 1.5

        # After 50 games: weight = 0.85
        result_50 = blend_mid_season(xgb, actual, games_played=50)
        expected_bpg_50 = 0.85 * 3.6 + 0.15 * 1.5  # = 3.285
        assert result_50["bpg"] == pytest.approx(expected_bpg_50, abs=0.001)
        assert result_50["bpg"] > 3.0  # Very close to actual

    def test_15_percent_historical_floor(self):
        """Even at full season, 15% historical weight prevents pure recency bias."""
        xgb = XGB_PREDS.copy()
        actual = CURRENT_ACTUALS.copy()

        result = blend_mid_season(xgb, actual, games_played=82)

        # Should not equal actuals exactly (15% historical remains)
        for stat in STAT_TARGETS:
            if XGB_PREDS[stat] != CURRENT_ACTUALS[stat]:
                assert result[stat] != CURRENT_ACTUALS[stat]
                # Should be closer to actuals than to projection
                dist_to_actual = abs(result[stat] - CURRENT_ACTUALS[stat])
                dist_to_proj = abs(result[stat] - XGB_PREDS[stat])
                assert dist_to_actual < dist_to_proj
