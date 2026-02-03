"""Draft optimizer API endpoints."""

from draft_optimizer import (
    DraftOptimizer,
    OptimizationRequest,
    PlayerProjection,
    RosterConfig,
)
from draft_optimizer.mock_data import generate_mock_players
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/draft", tags=["draft"])


class OptimizeRequest(BaseModel):
    """Request body for draft optimization."""

    players: list[PlayerProjection] | None = Field(
        default=None,
        description="Player pool to optimize from. If not provided, uses mock data.",
    )
    config: RosterConfig = Field(default_factory=RosterConfig)
    excluded_player_ids: list[str] = Field(
        default=[],
        description="Player IDs already drafted by opponents",
    )
    locked_player_ids: list[str] = Field(
        default=[],
        description="Player IDs you must draft",
    )
    use_mock_data: bool = Field(
        default=False,
        description="Use generated mock player data instead of provided players",
    )
    mock_player_count: int = Field(
        default=150,
        ge=50,
        le=500,
        description="Number of mock players to generate (if use_mock_data=True)",
    )


class SelectedPlayerResponse(BaseModel):
    """A player in the optimized roster."""

    id: str
    name: str
    team: str
    position: str
    slot: str
    is_starter: bool
    projected_fpts: float
    auction_value: float
    # Individual stats
    points: float
    rebounds: float
    assists: float
    steals: float
    blocks: float
    turnovers: float
    fg_pct: float
    ft_pct: float
    three_made: float


class OptimizeResponse(BaseModel):
    """Response from draft optimization."""

    status: str
    total_projected_fpts: float
    total_cost: float
    budget: float
    budget_remaining: float
    roster_size: int
    starter_count: int
    roster: list[SelectedPlayerResponse]


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_draft(request: OptimizeRequest) -> OptimizeResponse:
    """Optimize a fantasy basketball draft roster.

    Uses linear programming to maximize projected fantasy points while
    satisfying budget and position constraints.

    **Standard Roster (13 players, $200 budget):**
    - Starters (10): PG, SG, G, SF, PF, F, C, 3×UTIL
    - Bench (3)

    **Custom Configurations:**
    Override `config.slots` for different roster structures (e.g., 2 Centers).

    **Player Pool:**
    - Provide your own `players` list, OR
    - Set `use_mock_data=True` to generate test data
    """
    # Get player pool
    if request.use_mock_data or request.players is None:
        players = generate_mock_players(
            count=request.mock_player_count,
            budget=request.config.budget,
            roster_size=request.config.roster_size,
        )
    else:
        if len(request.players) < request.config.roster_size:
            raise HTTPException(
                status_code=400,
                detail=f"Need at least {request.config.roster_size} players, got {len(request.players)}",
            )
        players = request.players

    # Build optimization request
    opt_request = OptimizationRequest(
        players=players,
        config=request.config,
        excluded_player_ids=request.excluded_player_ids,
        locked_player_ids=request.locked_player_ids,
    )

    # Run optimizer
    try:
        optimizer = DraftOptimizer.from_request(opt_request)
        result = optimizer.solve()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if result.status != "Optimal":
        raise HTTPException(
            status_code=422,
            detail=f"Optimization failed: {result.status}. Try relaxing constraints.",
        )

    # Format response
    roster_response = [
        SelectedPlayerResponse(
            id=sp.player.id,
            name=sp.player.name,
            team=sp.player.team,
            position=sp.player.position.value if hasattr(sp.player.position, "value") else sp.player.position,
            slot=sp.slot.value,
            is_starter=sp.is_starter,
            projected_fpts=sp.player.projected_fpts,
            auction_value=sp.player.auction_value,
            points=sp.player.points,
            rebounds=sp.player.rebounds,
            assists=sp.player.assists,
            steals=sp.player.steals,
            blocks=sp.player.blocks,
            turnovers=sp.player.turnovers,
            fg_pct=sp.player.fg_pct,
            ft_pct=sp.player.ft_pct,
            three_made=sp.player.three_made,
        )
        for sp in result.roster
    ]

    return OptimizeResponse(
        status=result.status,
        total_projected_fpts=result.total_projected_fpts,
        total_cost=result.total_cost,
        budget=request.config.budget,
        budget_remaining=result.budget_remaining,
        roster_size=len(result.roster),
        starter_count=len(result.starters),
        roster=roster_response,
    )


@router.get("/config/default", response_model=RosterConfig)
async def get_default_config() -> RosterConfig:
    """Get the default roster configuration.

    Returns the standard 13-player, $200 budget configuration.
    """
    return RosterConfig()


@router.get("/config/slots")
async def get_slot_types() -> dict[str, list[str]]:
    """Get available roster slot types and their eligible positions.

    Useful for building custom roster configurations.
    """
    from draft_optimizer.schemas import SLOT_ELIGIBILITY

    return {
        slot.value: [pos.value for pos in positions]
        for slot, positions in SLOT_ELIGIBILITY.items()
    }


@router.post("/mock-players", response_model=list[PlayerProjection])
async def generate_mock_player_pool(
    count: int = 150,
    seed: int | None = None,
) -> list[PlayerProjection]:
    """Generate mock player data for testing.

    Args:
        count: Number of players to generate (50-500)
        seed: Random seed for reproducibility (None for random)

    Returns:
        List of PlayerProjection objects with realistic NBA stats
    """
    if count < 50 or count > 500:
        raise HTTPException(status_code=400, detail="Count must be between 50 and 500")

    return generate_mock_players(count=count, seed=seed)
