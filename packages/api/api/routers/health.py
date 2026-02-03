"""Health check endpoints."""

from core.db import get_db_url
from fastapi import APIRouter
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

router = APIRouter(prefix="/api/v1")


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Basic health check."""
    return {"status": "healthy"}


@router.get("/health/ready")
async def readiness_check() -> dict[str, str | dict[str, str]]:
    """Readiness check - verifies dependencies are available."""
    checks: dict[str, str] = {}

    # Check database connection
    try:
        engine = create_engine(get_db_url())
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = "healthy"
    except SQLAlchemyError as e:
        checks["database"] = f"unhealthy: {str(e)}"

    overall_status = "ready" if all(v == "healthy" for v in checks.values()) else "not_ready"

    return {
        "status": overall_status,
        "checks": checks,
    }
