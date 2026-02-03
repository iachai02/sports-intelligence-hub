"""Fantasy basketball draft optimizer using PuLP linear programming.

Solves the roster selection problem:
- Maximize total projected fantasy points
- Subject to budget, roster size, and position eligibility constraints
"""

from pulp import PULP_CBC_CMD, LpBinary, LpMaximize, LpProblem, LpVariable, lpSum, value

from draft_optimizer.schemas import (
    SLOT_ELIGIBILITY,
    OptimizationRequest,
    OptimizationResult,
    PlayerProjection,
    Position,
    RosterConfig,
    RosterSlot,
    SelectedPlayer,
)


class DraftOptimizer:
    """Linear programming optimizer for fantasy basketball drafts.

    Uses PuLP with CBC solver to find the optimal roster that maximizes
    projected fantasy points while satisfying budget and position constraints.

    Example:
        >>> from draft_optimizer import DraftOptimizer
        >>> from draft_optimizer.mock_data import generate_mock_players
        >>>
        >>> players = generate_mock_players(150)
        >>> optimizer = DraftOptimizer(players)
        >>> result = optimizer.solve()
        >>> print(f"Total projected: {result.total_projected_fpts}")
        >>> for p in result.roster:
        ...     print(f"{p.slot.value}: {p.player.name} (${p.player.auction_value})")
    """

    def __init__(
        self,
        players: list[PlayerProjection],
        config: RosterConfig | None = None,
        excluded_ids: list[str] | None = None,
        locked_ids: list[str] | None = None,
    ):
        """Initialize optimizer with player pool and configuration.

        Args:
            players: Pool of available players to draft from
            config: Roster configuration (uses default 13-roster if None)
            excluded_ids: Player IDs to exclude (already drafted by others)
            locked_ids: Player IDs that must be included in roster
        """
        self.config = config or RosterConfig()
        self.excluded_ids = set(excluded_ids or [])
        self.locked_ids = set(locked_ids or [])

        # Filter out excluded players
        self.players = [p for p in players if p.id not in self.excluded_ids]

        # Validate locked players exist
        player_ids = {p.id for p in self.players}
        missing_locked = self.locked_ids - player_ids
        if missing_locked:
            raise ValueError(f"Locked players not found in pool: {missing_locked}")

        # Build lookup
        self.player_by_id = {p.id: p for p in self.players}

        # Problem and variables (set during build)
        self._problem: LpProblem | None = None
        self._x: dict[tuple[str, int], LpVariable] | None = None

    def _is_eligible(self, player: PlayerProjection, slot: RosterSlot) -> bool:
        """Check if a player's position can fill a roster slot."""
        player_position = Position(player.position)
        eligible_positions = SLOT_ELIGIBILITY[slot]
        return player_position in eligible_positions

    def _build_problem(self) -> None:
        """Build the linear programming problem."""
        self._problem = LpProblem("Fantasy_Draft_Optimizer", LpMaximize)

        # Decision variables: x[player_id, slot_index] = 1 if player fills that slot
        self._x = {}
        for player in self.players:
            for slot_idx, slot in enumerate(self.config.slots):
                if self._is_eligible(player, slot):
                    var_name = f"x_{player.id}_{slot_idx}"
                    self._x[(player.id, slot_idx)] = LpVariable(var_name, cat=LpBinary)

        # Objective: maximize total projected fantasy points
        self._problem += lpSum(
            player.projected_fpts * self._x[(player.id, slot_idx)]
            for player in self.players
            for slot_idx, slot in enumerate(self.config.slots)
            if (player.id, slot_idx) in self._x
        ), "Total_Projected_Fantasy_Points"

        # Constraint 1: Each slot filled exactly once
        for slot_idx, slot in enumerate(self.config.slots):
            eligible_vars = [
                self._x[(p.id, slot_idx)]
                for p in self.players
                if (p.id, slot_idx) in self._x
            ]
            if eligible_vars:
                self._problem += (
                    lpSum(eligible_vars) == 1,
                    f"Fill_Slot_{slot_idx}_{slot.value}",
                )

        # Constraint 2: Each player selected at most once (across all slots)
        for player in self.players:
            player_vars = [
                self._x[(player.id, slot_idx)]
                for slot_idx in range(len(self.config.slots))
                if (player.id, slot_idx) in self._x
            ]
            if player_vars:
                self._problem += (
                    lpSum(player_vars) <= 1,
                    f"Player_Once_{player.id}",
                )

        # Constraint 3: Budget constraint
        self._problem += (
            lpSum(
                player.auction_value * self._x[(player.id, slot_idx)]
                for player in self.players
                for slot_idx in range(len(self.config.slots))
                if (player.id, slot_idx) in self._x
            )
            <= self.config.budget,
            "Budget_Constraint",
        )

        # Constraint 4: Locked players must be selected
        for locked_id in self.locked_ids:
            player = self.player_by_id[locked_id]
            locked_vars = [
                self._x[(locked_id, slot_idx)]
                for slot_idx in range(len(self.config.slots))
                if (locked_id, slot_idx) in self._x
            ]
            if locked_vars:
                self._problem += (
                    lpSum(locked_vars) == 1,
                    f"Locked_Player_{locked_id}",
                )

    def solve(self, time_limit: int = 60, verbose: bool = False) -> OptimizationResult:
        """Solve the optimization problem.

        Args:
            time_limit: Maximum solve time in seconds
            verbose: Whether to print solver output

        Returns:
            OptimizationResult with selected roster and totals
        """
        # Build problem if not already built
        if self._problem is None:
            self._build_problem()

        # At this point _problem and _x are guaranteed to be set
        assert self._problem is not None
        assert self._x is not None

        # Solve with CBC (comes bundled with PuLP)
        solver = PULP_CBC_CMD(msg=verbose, timeLimit=time_limit)
        self._problem.solve(solver)

        # Extract results
        status = self._problem.status
        status_name = {
            1: "Optimal",
            0: "Not Solved",
            -1: "Infeasible",
            -2: "Unbounded",
            -3: "Undefined",
        }.get(status, f"Unknown ({status})")

        if status != 1:
            return OptimizationResult(
                status=status_name,
                roster=[],
                total_projected_fpts=0.0,
                total_cost=0.0,
                budget_remaining=self.config.budget,
            )

        # Extract selected players and their slots
        roster: list[SelectedPlayer] = []
        for (player_id, slot_idx), var in self._x.items():
            if value(var) == 1:
                player = self.player_by_id[player_id]
                slot = self.config.slots[slot_idx]
                is_starter = slot != RosterSlot.BENCH
                roster.append(
                    SelectedPlayer(player=player, slot=slot, is_starter=is_starter)
                )

        # Sort by slot position in config (starters first, then bench)
        slot_indices = {slot: i for i, slot in enumerate(self.config.slots)}
        roster.sort(key=lambda sp: slot_indices.get(sp.slot, 999))

        # Calculate totals
        total_fpts = sum(sp.player.projected_fpts for sp in roster)
        total_cost = sum(sp.player.auction_value for sp in roster)
        budget_remaining = self.config.budget - total_cost

        return OptimizationResult(
            status=status_name,
            roster=roster,
            total_projected_fpts=round(total_fpts, 2),
            total_cost=round(total_cost, 2),
            budget_remaining=round(budget_remaining, 2),
        )

    @classmethod
    def from_request(cls, request: OptimizationRequest) -> "DraftOptimizer":
        """Create optimizer from an API request.

        Args:
            request: OptimizationRequest with players and config

        Returns:
            Configured DraftOptimizer instance
        """
        return cls(
            players=request.players,
            config=request.config,
            excluded_ids=request.excluded_player_ids,
            locked_ids=request.locked_player_ids,
        )


def optimize_draft(
    players: list[PlayerProjection],
    config: RosterConfig | None = None,
    excluded_ids: list[str] | None = None,
    locked_ids: list[str] | None = None,
    verbose: bool = False,
) -> OptimizationResult:
    """Convenience function to optimize a draft in one call.

    Args:
        players: Pool of available players
        config: Roster configuration (default 13-roster, $200)
        excluded_ids: Players to exclude
        locked_ids: Players that must be included
        verbose: Print solver output

    Returns:
        OptimizationResult with optimal roster

    Example:
        >>> from draft_optimizer import optimize_draft
        >>> from draft_optimizer.mock_data import generate_mock_players
        >>>
        >>> players = generate_mock_players(150)
        >>> result = optimize_draft(players)
        >>> print(f"Status: {result.status}")
        >>> print(f"Total FPTS: {result.total_projected_fpts}")
        >>> print(f"Cost: ${result.total_cost} / ${result.budget_remaining} remaining")
    """
    optimizer = DraftOptimizer(
        players=players,
        config=config,
        excluded_ids=excluded_ids,
        locked_ids=locked_ids,
    )
    return optimizer.solve(verbose=verbose)
