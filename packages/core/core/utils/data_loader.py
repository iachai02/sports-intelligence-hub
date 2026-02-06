"""NBA data fetching with caching."""

import time
from typing import cast

import diskcache
import pandas as pd


class NBADataLoader:
    """Fetches NBA data with rate limiting and caching."""

    def __init__(self, cache_dir: str = "data/cache"):
        self.cache = diskcache.Cache(cache_dir)
        self.rate_limit_delay = 1.0  # 1 second between requests

    def get_games(self, season: str, force_refresh: bool = False) -> pd.DataFrame:
        """
        Fetch games for a season.

        Args:
            season: Season string like "2024-25"
            force_refresh: If True, bypass cache

        Returns:
            DataFrame with game data
        """
        cache_key = f"games_{season}"

        if not force_refresh and cache_key in self.cache:
            return cast(pd.DataFrame, self.cache[cache_key])

        # Rate limiting
        time.sleep(self.rate_limit_delay)

        # Import here to avoid import errors if nba_api not installed
        from nba_api.stats.endpoints import leaguegamefinder

        games = leaguegamefinder.LeagueGameFinder(
            season_nullable=season,
            league_id_nullable="00",  # NBA
        ).get_data_frames()[0]

        # Cache for 24 hours
        self.cache.set(cache_key, games, expire=86400)
        return games

    def get_player_stats(
        self, season: str, force_refresh: bool = False
    ) -> pd.DataFrame:
        """
        Fetch player stats for a season.

        Args:
            season: Season string like "2024-25"
            force_refresh: If True, bypass cache

        Returns:
            DataFrame with player game logs
        """
        cache_key = f"player_stats_{season}"

        if not force_refresh and cache_key in self.cache:
            return cast(pd.DataFrame, self.cache[cache_key])

        time.sleep(self.rate_limit_delay)

        from nba_api.stats.endpoints import playergamelogs

        stats = playergamelogs.PlayerGameLogs(
            season_nullable=season,
            league_id_nullable="00",
        ).get_data_frames()[0]

        self.cache.set(cache_key, stats, expire=86400)
        return stats

    def get_player_bio_stats(
        self, season: str, force_refresh: bool = False
    ) -> pd.DataFrame:
        """
        Fetch player bio/demographic stats for a season.

        Returns age, height, weight, draft info, USG%, TS%, NET_RATING,
        AST%, OREB%, DREB% for all players in a single API call.

        Args:
            season: Season string like "2024-25"
            force_refresh: If True, bypass cache

        Returns:
            DataFrame with player bio and advanced stats
        """
        cache_key = f"player_bio_{season}"

        if not force_refresh and cache_key in self.cache:
            return cast(pd.DataFrame, self.cache[cache_key])

        time.sleep(self.rate_limit_delay)

        from nba_api.stats.endpoints import leaguedashplayerbiostats

        bio = leaguedashplayerbiostats.LeagueDashPlayerBioStats(
            season=season,
            league_id="00",
            per_mode_simple="PerGame",
        ).get_data_frames()[0]

        self.cache.set(cache_key, bio, expire=86400)
        return bio

    def get_player_estimated_metrics(
        self, season: str, force_refresh: bool = False
    ) -> pd.DataFrame:
        """
        Fetch player estimated advanced metrics for a season.

        Returns E_USG_PCT, E_PACE, E_OFF_RATING, E_DEF_RATING,
        E_NET_RATING, E_TOV_PCT for all players in a single API call.

        Args:
            season: Season string like "2024-25"
            force_refresh: If True, bypass cache

        Returns:
            DataFrame with player estimated metrics
        """
        cache_key = f"player_estimated_{season}"

        if not force_refresh and cache_key in self.cache:
            return cast(pd.DataFrame, self.cache[cache_key])

        time.sleep(self.rate_limit_delay)

        from nba_api.stats.endpoints import playerestimatedmetrics

        metrics = playerestimatedmetrics.PlayerEstimatedMetrics(
            season=season,
            league_id="00",
        ).get_data_frames()[0]

        self.cache.set(cache_key, metrics, expire=86400)
        return metrics

    def get_team_estimated_metrics(
        self, season: str, force_refresh: bool = False
    ) -> pd.DataFrame:
        """
        Fetch team estimated metrics for a season.

        Returns team pace, offensive/defensive rating for all teams
        in a single API call.

        Args:
            season: Season string like "2024-25"
            force_refresh: If True, bypass cache

        Returns:
            DataFrame with team estimated metrics
        """
        cache_key = f"team_estimated_{season}"

        if not force_refresh and cache_key in self.cache:
            return cast(pd.DataFrame, self.cache[cache_key])

        time.sleep(self.rate_limit_delay)

        from nba_api.stats.endpoints import teamestimatedmetrics

        metrics = teamestimatedmetrics.TeamEstimatedMetrics(
            season=season,
            league_id="00",
        ).get_data_frames()[0]

        self.cache.set(cache_key, metrics, expire=86400)
        return metrics

    def clear_cache(self) -> None:
        """Clear all cached data."""
        self.cache.clear()
