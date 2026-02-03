"""NBA data fetching with caching."""

import time
from pathlib import Path

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
            return self.cache[cache_key]

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
            return self.cache[cache_key]

        time.sleep(self.rate_limit_delay)

        from nba_api.stats.endpoints import playergamelogs

        stats = playergamelogs.PlayerGameLogs(
            season_nullable=season,
            league_id_nullable="00",
        ).get_data_frames()[0]

        self.cache.set(cache_key, stats, expire=86400)
        return stats

    def clear_cache(self) -> None:
        """Clear all cached data."""
        self.cache.clear()
