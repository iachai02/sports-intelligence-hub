"""Tests for health endpoints."""

from api.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


class TestHealthEndpoints:
    """Tests for health check endpoints."""

    def test_health_check(self):
        """Test basic health check returns healthy."""
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

    def test_readiness_check(self):
        """Test readiness check returns expected structure."""
        response = client.get("/api/v1/health/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert "checks" in data
