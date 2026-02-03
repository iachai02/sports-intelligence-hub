"""Database connection utilities."""

import os
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker


def get_db_url() -> str:
    """Get database URL from environment."""
    return os.getenv(
        "DATABASE_URL",
        "postgresql://user:pass@localhost:5432/sports_hub",
    )


@lru_cache
def get_engine() -> Engine:
    """Create and cache database engine."""
    return create_engine(get_db_url(), echo=False)


def get_session() -> Session:
    """Create a new database session."""
    engine = get_engine()
    session_factory = sessionmaker(bind=engine)
    return session_factory()
