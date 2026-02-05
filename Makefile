.PHONY: install dev test lint format clean api web-install web-dev migrate migrate-create

# Install dependencies
install:
	uv sync --all-packages

# Run development API server
dev:
	uv run uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
test:
	uv run pytest -v

# Run tests with coverage
test-cov:
	uv run pytest --cov=packages --cov-report=html

# Lint code
lint:
	uv run ruff check packages/
	uv run mypy packages/

# Format code
format:
	uv run ruff format packages/
	uv run ruff check --fix packages/

# Clean build artifacts
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	rm -rf dist/ build/ htmlcov/ .coverage

# Start Docker services (PostgreSQL, MLflow)
docker-up:
	docker compose -f infrastructure/docker/docker-compose.yml up -d

# Stop Docker services
docker-down:
	docker compose -f infrastructure/docker/docker-compose.yml down

# Run database migrations
migrate:
	cd packages/core && uv run alembic upgrade head

# Create a new migration
migrate-create:
	cd packages/core && uv run alembic revision --autogenerate -m "$(msg)"

# Install web dependencies
web-install:
	cd apps/web && npm install

# Run web development server
web-dev:
	cd apps/web && npm run dev
