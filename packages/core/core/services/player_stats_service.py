"""Service for fetching and processing NBA player statistics."""

import logging
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session

from core.db.connection import get_session
from core.db.models import Player, PlayerSeasonStats
from core.utils.data_loader import NBADataLoader

logger = logging.getLogger(__name__)


class PlayerStatsService:
    """Service for fetching and aggregating NBA player statistics.

    This service handles:
    - Fetching player game logs from NBA API
    - Aggregating per-game logs into season averages
    - Storing season stats in the database
    """

    def __init__(
        self,
        cache_dir: str = "data/cache",
        session: Session | None = None,
    ) -> None:
        """Initialize the service.

        Args:
            cache_dir: Directory for caching NBA API responses
            session: Optional SQLAlchemy session (creates new if not provided)
        """
        self.loader = NBADataLoader(cache_dir=cache_dir)
        self._session = session

    @property
    def session(self) -> Session:
        """Get or create database session."""
        if self._session is None:
            self._session = get_session()
        return self._session

    def fetch_seasons(
        self,
        seasons: list[str],
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        """Fetch player game logs for multiple seasons.

        Args:
            seasons: List of seasons to fetch (e.g., ["2022-23", "2023-24", "2024-25"])
            force_refresh: If True, bypass cache and fetch fresh data

        Returns:
            DataFrame with combined game logs from all seasons
        """
        all_logs: list[pd.DataFrame] = []

        for season in seasons:
            logger.info(f"Fetching player stats for season {season}")
            try:
                stats = self.loader.get_player_stats(
                    season=season,
                    force_refresh=force_refresh,
                )
                stats["SEASON"] = season
                all_logs.append(stats)
                logger.info(f"Fetched {len(stats)} game logs for {season}")
            except Exception as e:
                logger.error(f"Failed to fetch stats for {season}: {e}")
                continue

        if not all_logs:
            return pd.DataFrame()

        return pd.concat(all_logs, ignore_index=True)

    def aggregate_season_averages(
        self,
        game_logs: pd.DataFrame,
    ) -> pd.DataFrame:
        """Convert per-game logs to season averages per player.

        Args:
            game_logs: DataFrame with per-game player statistics

        Returns:
            DataFrame with season averages for each player-season combination
        """
        if game_logs.empty:
            return pd.DataFrame()

        # NBA API column names (may vary slightly, handle common variations)
        # Standard columns: PLAYER_ID, PLAYER_NAME, TEAM_ABBREVIATION, SEASON
        # Stats: PTS, REB, AST, STL, BLK, TOV, MIN, FGM, FGA, FG_PCT, FTM, FTA, FT_PCT, FG3M, FG3_PCT

        # Get primary team for each player-season (most games played with)
        team_counts = (
            game_logs.groupby(["PLAYER_ID", "SEASON", "TEAM_ABBREVIATION"])
            .size()
            .reset_index(name="team_games")
        )
        primary_teams = team_counts.loc[
            team_counts.groupby(["PLAYER_ID", "SEASON"])["team_games"].idxmax()
        ][["PLAYER_ID", "SEASON", "TEAM_ABBREVIATION"]]

        # Group by player and season
        grouped = game_logs.groupby(["PLAYER_ID", "PLAYER_NAME", "SEASON"])

        # Aggregate statistics - both averages AND totals
        aggregated = grouped.agg(
            games_played=("PLAYER_ID", "count"),
            minutes_per_game=("MIN", "mean"),
            # Per-game averages
            ppg=("PTS", "mean"),
            rpg=("REB", "mean"),
            apg=("AST", "mean"),
            spg=("STL", "mean"),
            bpg=("BLK", "mean"),
            topg=("TOV", "mean"),
            three_pm=("FG3M", "mean"),
            fga=("FGA", "mean"),
            fta=("FTA", "mean"),
            # Season totals (important for valuation!)
            total_points=("PTS", "sum"),
            total_rebounds=("REB", "sum"),
            total_assists=("AST", "sum"),
            total_steals=("STL", "sum"),
            total_blocks=("BLK", "sum"),
            total_turnovers=("TOV", "sum"),
            total_minutes=("MIN", "sum"),
            total_three_pm=("FG3M", "sum"),
            # For percentages, we need to calculate from totals
            total_fgm=("FGM", "sum"),
            total_fga=("FGA", "sum"),
            total_ftm=("FTM", "sum"),
            total_fta=("FTA", "sum"),
            total_fg3m=("FG3M", "sum"),
            total_fg3a=("FG3A", "sum"),
        ).reset_index()

        # Merge in team info
        aggregated = aggregated.merge(
            primary_teams,
            on=["PLAYER_ID", "SEASON"],
            how="left",
        )
        aggregated = aggregated.rename(columns={"TEAM_ABBREVIATION": "TEAM"})

        # Calculate shooting percentages from totals (more accurate than averaging percentages)
        aggregated["fg_pct"] = (
            aggregated["total_fgm"] / aggregated["total_fga"].replace(0, 1)
        ).clip(0, 1)
        aggregated["ft_pct"] = (
            aggregated["total_ftm"] / aggregated["total_fta"].replace(0, 1)
        ).clip(0, 1)
        aggregated["three_pct"] = (
            aggregated["total_fg3m"] / aggregated["total_fg3a"].replace(0, 1)
        ).clip(0, 1)

        # Drop only the intermediate percentage calculation columns
        # Keep the totals for fantasy valuation
        aggregated = aggregated.drop(
            columns=[
                "total_fgm",
                "total_fga",
                "total_ftm",
                "total_fta",
                "total_fg3m",
                "total_fg3a",
            ]
        )

        # Round numeric columns
        numeric_cols = [
            "minutes_per_game",
            "ppg",
            "rpg",
            "apg",
            "spg",
            "bpg",
            "topg",
            "three_pm",
            "fga",
            "fta",
            "fg_pct",
            "ft_pct",
            "three_pct",
            "total_points",
            "total_rebounds",
            "total_assists",
            "total_steals",
            "total_blocks",
            "total_turnovers",
            "total_minutes",
            "total_three_pm",
        ]
        for col in numeric_cols:
            if col in aggregated.columns:
                aggregated[col] = aggregated[col].round(3)

        return aggregated

    def get_projection_ready_data(
        self,
        seasons: list[str] | None = None,
        min_games: int = 20,
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        """Return player data ready for ML training.

        This method fetches, aggregates, and filters data to create a clean
        dataset suitable for training projection models.

        Args:
            seasons: Seasons to fetch (defaults to last 3 seasons)
            min_games: Minimum games played to include a player-season
            force_refresh: If True, bypass cache

        Returns:
            DataFrame with season averages for qualifying player-seasons
        """
        if seasons is None:
            seasons = ["2022-23", "2023-24", "2024-25"]

        # Fetch raw game logs
        game_logs = self.fetch_seasons(seasons, force_refresh=force_refresh)

        if game_logs.empty:
            logger.warning("No game logs fetched")
            return pd.DataFrame()

        # Aggregate to season averages
        season_avgs = self.aggregate_season_averages(game_logs)

        # Filter by minimum games
        season_avgs = season_avgs[season_avgs["games_played"] >= min_games]

        logger.info(
            f"Projection-ready data: {len(season_avgs)} player-seasons "
            f"(min {min_games} games)"
        )

        return season_avgs

    def get_enhanced_projection_data(
        self,
        seasons: list[str] | None = None,
        min_games: int = 20,
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        """Return player data with advanced stats for enhanced ML training.

        Fetches base stats, player bio/demographics, player estimated metrics,
        and team estimated metrics, then joins them all together.

        Args:
            seasons: Seasons to fetch (defaults to last 5 seasons)
            min_games: Minimum games played to include a player-season
            force_refresh: If True, bypass cache

        Returns:
            DataFrame with season averages + advanced stats for qualifying player-seasons
        """
        if seasons is None:
            seasons = ["2020-21", "2021-22", "2022-23", "2023-24", "2024-25"]

        # Step 1: Get base projection-ready data
        base_data = self.get_projection_ready_data(
            seasons=seasons,
            min_games=min_games,
            force_refresh=force_refresh,
        )

        if base_data.empty:
            return base_data

        # Step 2: Fetch advanced + demographic data for each season
        bio_frames: list[pd.DataFrame] = []
        player_est_frames: list[pd.DataFrame] = []
        team_est_frames: list[pd.DataFrame] = []

        for season in seasons:
            # Player bio stats (age, height, weight, draft info)
            try:
                bio = self.loader.get_player_bio_stats(
                    season=season, force_refresh=force_refresh
                )
                bio["SEASON"] = season
                bio_frames.append(bio)
            except Exception as e:
                logger.warning(f"Failed to fetch bio stats for {season}: {e}")

            # Player estimated metrics (USG%, OFF/DEF rating, etc.)
            try:
                player_est = self.loader.get_player_estimated_metrics(
                    season=season, force_refresh=force_refresh
                )
                player_est["SEASON"] = season
                player_est_frames.append(player_est)
            except Exception as e:
                logger.warning(f"Failed to fetch player estimated metrics for {season}: {e}")

            # Team estimated metrics (pace, OFF/DEF rating per team)
            try:
                team_est = self.loader.get_team_estimated_metrics(
                    season=season, force_refresh=force_refresh
                )
                team_est["SEASON"] = season
                team_est_frames.append(team_est)
            except Exception as e:
                logger.warning(f"Failed to fetch team estimated metrics for {season}: {e}")

        # Step 3: Merge bio data
        if bio_frames:
            all_bio = pd.concat(bio_frames, ignore_index=True)
            # Select columns we need and rename for clarity
            bio_cols = ["PLAYER_ID", "SEASON"]
            col_mapping: dict[str, str] = {}
            for col in [
                "PLAYER_HEIGHT_INCHES",
                "PLAYER_WEIGHT",
                "DRAFT_ROUND",
                "DRAFT_NUMBER",
                "AGE",
                "USG_PCT",
                "TS_PCT",
                "NET_RATING",
                "AST_PCT",
                "OREB_PCT",
                "DREB_PCT",
            ]:
                if col in all_bio.columns:
                    bio_cols.append(col)
                    col_mapping[col] = col.lower()

            # Some endpoints use PLAYER_HEIGHT instead of PLAYER_HEIGHT_INCHES
            if "PLAYER_HEIGHT_INCHES" not in all_bio.columns and "PLAYER_HEIGHT" in all_bio.columns:
                # Convert height string like "6-10" to inches
                def height_to_inches(h: object) -> float | None:
                    if pd.isna(h) or h is None:
                        return None
                    h_str = str(h)
                    if "-" in h_str:
                        parts = h_str.split("-")
                        try:
                            return float(parts[0]) * 12 + float(parts[1])
                        except (ValueError, IndexError):
                            return None
                    try:
                        return float(h_str)
                    except ValueError:
                        return None

                all_bio["PLAYER_HEIGHT_INCHES"] = all_bio["PLAYER_HEIGHT"].apply(
                    height_to_inches
                )
                if "PLAYER_HEIGHT_INCHES" not in bio_cols:
                    bio_cols.append("PLAYER_HEIGHT_INCHES")
                    col_mapping["PLAYER_HEIGHT_INCHES"] = "player_height_inches"

            available_bio_cols = [c for c in bio_cols if c in all_bio.columns]
            bio_subset = all_bio[available_bio_cols].copy()
            bio_subset = bio_subset.rename(
                columns={k: v for k, v in col_mapping.items() if k in bio_subset.columns}
            )

            base_data = base_data.merge(
                bio_subset,
                on=["PLAYER_ID", "SEASON"],
                how="left",
            )

        # Step 4: Merge player estimated metrics
        if player_est_frames:
            all_player_est = pd.concat(player_est_frames, ignore_index=True)
            est_cols = ["PLAYER_ID", "SEASON"]
            est_col_mapping: dict[str, str] = {}
            for col in [
                "E_USG_PCT",
                "E_PACE",
                "E_OFF_RATING",
                "E_DEF_RATING",
                "E_NET_RATING",
                "E_TOV_PCT",
            ]:
                if col in all_player_est.columns:
                    est_cols.append(col)
                    est_col_mapping[col] = col.lower()

            available_est_cols = [c for c in est_cols if c in all_player_est.columns]
            est_subset = all_player_est[available_est_cols].copy()
            est_subset = est_subset.rename(
                columns={k: v for k, v in est_col_mapping.items() if k in est_subset.columns}
            )

            base_data = base_data.merge(
                est_subset,
                on=["PLAYER_ID", "SEASON"],
                how="left",
            )

        # Step 5: Merge team estimated metrics
        # Note: TeamEstimatedMetrics returns TEAM_ID + TEAM_NAME but NOT
        # TEAM_ABBREVIATION, so we map TEAM_ID → abbreviation via nba_api static data.
        if team_est_frames:
            all_team_est = pd.concat(team_est_frames, ignore_index=True)

            # Build TEAM_ID → abbreviation lookup
            if "TEAM_ID" in all_team_est.columns:
                from nba_api.stats.static import teams as nba_teams

                team_id_to_abbr = {
                    t["id"]: t["abbreviation"] for t in nba_teams.get_teams()
                }
                all_team_est["TEAM_ABBREVIATION"] = (
                    all_team_est["TEAM_ID"].map(team_id_to_abbr)
                )

            team_cols = ["TEAM_ABBREVIATION", "SEASON"]
            team_col_mapping: dict[str, str] = {}
            for col in ["E_PACE", "E_OFF_RATING", "E_DEF_RATING"]:
                team_col_name = f"TEAM_{col}"
                if col in all_team_est.columns:
                    all_team_est = all_team_est.rename(columns={col: team_col_name})
                    team_cols.append(team_col_name)
                    team_col_mapping[team_col_name] = f"team_{col.lower()}"

            available_team_cols = [c for c in team_cols if c in all_team_est.columns]
            team_subset = all_team_est[available_team_cols].copy()
            team_subset = team_subset.rename(
                columns={
                    "TEAM_ABBREVIATION": "TEAM",
                    **{k: v for k, v in team_col_mapping.items() if k in team_subset.columns},
                }
            )

            base_data = base_data.merge(
                team_subset,
                on=["TEAM", "SEASON"],
                how="left",
            )

        # Step 6: Detect team changes between consecutive seasons per player
        base_data = base_data.sort_values(["PLAYER_ID", "SEASON"])
        base_data["prev_team"] = base_data.groupby("PLAYER_ID")["TEAM"].shift(1)
        base_data["changed_team"] = (
            (base_data["prev_team"].notna())
            & (base_data["TEAM"] != base_data["prev_team"])
        ).astype(int)
        base_data = base_data.drop(columns=["prev_team"])

        # Step 7: Compute season_exp (years since draft — approximate from seasons in data)
        if "draft_number" in base_data.columns:
            # season_exp = seasons of NBA experience (from first season in dataset per player)
            first_season = (
                base_data.groupby("PLAYER_ID")["SEASON"]
                .min()
                .reset_index()
                .rename(columns={"SEASON": "first_season"})
            )
            base_data = base_data.merge(first_season, on="PLAYER_ID", how="left")

            def season_to_year(s: str) -> int:
                try:
                    return int(s.split("-")[0])
                except (ValueError, IndexError):
                    return 0

            base_data["season_exp"] = base_data.apply(
                lambda r: season_to_year(str(r["SEASON"])) - season_to_year(str(r["first_season"])),
                axis=1,
            )
            base_data = base_data.drop(columns=["first_season"])
        else:
            base_data["season_exp"] = 0

        # Step 8: Fill missing advanced stats with per-season league averages
        advanced_cols = [
            c
            for c in base_data.columns
            if c
            in {
                "usg_pct",
                "ts_pct",
                "net_rating",
                "ast_pct",
                "oreb_pct",
                "dreb_pct",
                "e_usg_pct",
                "e_pace",
                "e_off_rating",
                "e_def_rating",
                "e_net_rating",
                "e_tov_pct",
                "team_e_pace",
                "team_e_off_rating",
                "team_e_def_rating",
                "player_height_inches",
                "player_weight",
                "age",
                "draft_round",
                "draft_number",
            }
        ]

        for col in advanced_cols:
            if base_data[col].isna().any():
                season_means = base_data.groupby("SEASON")[col].transform("mean")
                base_data[col] = base_data[col].fillna(season_means)
                # If still NaN (entire season missing), fill with global mean
                base_data[col] = base_data[col].fillna(base_data[col].mean())

        logger.info(
            f"Enhanced projection data: {len(base_data)} player-seasons, "
            f"{len(base_data.columns)} columns"
        )

        return base_data

    def store_season_stats(
        self,
        season_avgs: pd.DataFrame,
        update_existing: bool = True,
    ) -> int:
        """Store aggregated season stats in the database.

        Args:
            season_avgs: DataFrame from aggregate_season_averages()
            update_existing: If True, update existing records; if False, skip them

        Returns:
            Number of records stored/updated
        """
        if season_avgs.empty:
            return 0

        count = 0
        session = self.session

        for _, row in season_avgs.iterrows():
            nba_player_id = str(row["PLAYER_ID"])
            season = row["SEASON"]

            # Get or create player
            player = (
                session.query(Player)
                .filter(Player.nba_player_id == nba_player_id)
                .first()
            )

            if player is None:
                # Create new player
                player = Player(
                    nba_player_id=nba_player_id,
                    name=row["PLAYER_NAME"],
                    is_active=True,
                )
                session.add(player)
                session.flush()  # Get player.id

            # Check if season stats exist
            existing_stats = (
                session.query(PlayerSeasonStats)
                .filter(
                    PlayerSeasonStats.player_id == player.id,
                    PlayerSeasonStats.season == season,
                )
                .first()
            )

            if existing_stats and not update_existing:
                continue

            if existing_stats:
                stats = existing_stats
            else:
                stats = PlayerSeasonStats(
                    player_id=player.id,
                    season=season,
                )
                session.add(stats)

            # Update stats
            stats.games_played = int(row["games_played"])
            stats.minutes_per_game = float(row["minutes_per_game"])
            stats.ppg = float(row["ppg"])
            stats.rpg = float(row["rpg"])
            stats.apg = float(row["apg"])
            stats.spg = float(row["spg"])
            stats.bpg = float(row["bpg"])
            stats.topg = float(row["topg"])
            stats.fg_pct = float(row["fg_pct"])
            stats.ft_pct = float(row["ft_pct"])
            stats.three_pm = float(row["three_pm"])
            stats.three_pct = float(row["three_pct"])
            stats.fga = float(row["fga"])
            stats.fta = float(row["fta"])
            stats.team = row.get("TEAM")

            count += 1

        session.commit()
        logger.info(f"Stored/updated {count} player season stats")

        return count

    def get_all_season_stats(
        self,
        seasons: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Retrieve all stored season stats from database.

        Args:
            seasons: Optional filter by seasons

        Returns:
            List of season stats as dictionaries
        """
        session = self.session
        query = session.query(PlayerSeasonStats).join(Player)

        if seasons:
            query = query.filter(PlayerSeasonStats.season.in_(seasons))

        stats = query.all()

        return [
            {
                "player_id": s.player_id,
                "nba_player_id": s.player.nba_player_id,
                "player_name": s.player.name,
                "season": s.season,
                "games_played": s.games_played,
                "minutes_per_game": s.minutes_per_game,
                "ppg": s.ppg,
                "rpg": s.rpg,
                "apg": s.apg,
                "spg": s.spg,
                "bpg": s.bpg,
                "topg": s.topg,
                "fg_pct": s.fg_pct,
                "ft_pct": s.ft_pct,
                "three_pm": s.three_pm,
                "three_pct": s.three_pct,
                "team": s.team,
            }
            for s in stats
        ]
