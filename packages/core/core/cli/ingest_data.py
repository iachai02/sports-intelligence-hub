"""CLI command for ingesting NBA player data.

Usage:
    uv run python -m core.cli.ingest_data --seasons 2022-23 2023-24 2024-25
    uv run python -m core.cli.ingest_data --seasons 2024-25 --min-games 10
    uv run python -m core.cli.ingest_data --seasons 2024-25 --store
"""

import argparse
import logging
import sys

from core.services.player_stats_service import PlayerStatsService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> int:
    """Main entry point for data ingestion CLI."""
    parser = argparse.ArgumentParser(
        description="Ingest NBA player statistics for ML training",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Fetch and display stats for 2024-25 season
  uv run python -m core.cli.ingest_data --seasons 2024-25

  # Fetch 3 seasons of data and store in database
  uv run python -m core.cli.ingest_data --seasons 2022-23 2023-24 2024-25 --store

  # Fetch with lower minimum games threshold
  uv run python -m core.cli.ingest_data --seasons 2024-25 --min-games 10

  # Force refresh (bypass cache)
  uv run python -m core.cli.ingest_data --seasons 2024-25 --refresh
        """,
    )

    parser.add_argument(
        "--seasons",
        nargs="+",
        default=["2024-25"],
        help="Seasons to fetch (e.g., 2022-23 2023-24 2024-25)",
    )

    parser.add_argument(
        "--min-games",
        type=int,
        default=20,
        help="Minimum games played to include a player (default: 20)",
    )

    parser.add_argument(
        "--store",
        action="store_true",
        help="Store results in database (requires running PostgreSQL)",
    )

    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Force refresh from NBA API (bypass cache)",
    )

    parser.add_argument(
        "--cache-dir",
        default="data/cache",
        help="Directory for caching API responses",
    )

    parser.add_argument(
        "--output",
        type=str,
        help="Output CSV file path (optional)",
    )

    args = parser.parse_args()

    logger.info(f"Ingesting data for seasons: {args.seasons}")
    logger.info(f"Minimum games threshold: {args.min_games}")

    # Create service
    service = PlayerStatsService(cache_dir=args.cache_dir)

    # Fetch and aggregate data
    data = service.get_projection_ready_data(
        seasons=args.seasons,
        min_games=args.min_games,
        force_refresh=args.refresh,
    )

    if data.empty:
        logger.error("No data fetched. Check your internet connection or NBA API status.")
        return 1

    # Display summary
    logger.info(f"\nFetched {len(data)} player-seasons")
    logger.info(f"Seasons: {data['SEASON'].unique().tolist()}")
    logger.info(f"Players: {data['PLAYER_ID'].nunique()}")

    # Show top players by PPG
    top_scorers = data.nlargest(10, "ppg")[
        ["PLAYER_NAME", "SEASON", "games_played", "ppg", "rpg", "apg"]
    ]
    logger.info("\nTop 10 scorers:")
    print(top_scorers.to_string(index=False))

    # Store in database if requested
    if args.store:
        try:
            count = service.store_season_stats(data)
            logger.info(f"\nStored {count} player-seasons in database")
        except Exception as e:
            logger.error(f"Failed to store in database: {e}")
            logger.error("Make sure PostgreSQL is running (make docker-up)")
            return 1

    # Save to CSV if requested
    if args.output:
        data.to_csv(args.output, index=False)
        logger.info(f"\nSaved data to {args.output}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
