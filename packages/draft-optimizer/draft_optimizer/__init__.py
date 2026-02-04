"""Fantasy basketball draft optimizer package."""

from draft_optimizer.features import (
    POSITION_SCARCITY,
    calculate_auction_value,
    calculate_auction_value_v2,
    calculate_fantasy_points,
    calculate_player_projection,
    calculate_player_projections_batch,
    calculate_pool_auction_values,
)
from draft_optimizer.optimizer import DraftOptimizer, optimize_draft
from draft_optimizer.schemas import (
    OptimizationRequest,
    OptimizationResult,
    PlayerProjection,
    Position,
    RosterConfig,
    RosterSlot,
)

__all__ = [
    "DraftOptimizer",
    "OptimizationRequest",
    "OptimizationResult",
    "PlayerProjection",
    "Position",
    "POSITION_SCARCITY",
    "RosterConfig",
    "RosterSlot",
    "calculate_auction_value",
    "calculate_auction_value_v2",
    "calculate_fantasy_points",
    "calculate_player_projection",
    "calculate_player_projections_batch",
    "calculate_pool_auction_values",
    "optimize_draft",
]
