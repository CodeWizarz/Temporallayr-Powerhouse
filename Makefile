.PHONY: lint format typecheck test coverage ci security help

QUALITY_PATHS = src tests

help:
	@echo "Available commands:"
	@echo "  make lint       : Run lint checks (ruff, black check)"
	@echo "  make format     : Run auto-formatters (black, ruff fix)"
	@echo "  make typecheck  : Run static type analysis (mypy)"
	@echo "  make test       : Run unit and integration tests"
	@echo "  make coverage   : Run tests with coverage report"
	@echo "  make security   : Run security scans (bandit, pip-audit)"
	@echo "  make ci         : Run full quality gate (lint, typecheck, test, coverage, security)"

lint:
	ruff check $(QUALITY_PATHS)
	black --check $(QUALITY_PATHS)

format:
	black $(QUALITY_PATHS)
	ruff check --fix $(QUALITY_PATHS)

typecheck:
	mypy src tests

test:
	pytest

coverage:
	coverage run -m pytest
	coverage report -m --fail-under=80

security:
	bandit -r src/ -ll
	pip-audit

ci: lint typecheck test coverage security

# ── Dashboard ────────────────────────────────────────────────────────────────

dashboard-install:
	cd dashboard && npm install

dashboard-dev:
	cd dashboard && npm run dev

dashboard-build:
	cd dashboard && npm run build

dashboard-preview:
	cd dashboard && npm run preview

# ── Workers ──────────────────────────────────────────────────────────────────

worker:
	python workers/ingest_worker.py

worker-docker-build:
	docker build -f docker/worker/Dockerfile -t temporallayr-worker:latest .

# ── Full stack (dev) ──────────────────────────────────────────────────────────

dev-server:
	TEMPORALLAYR_LOG_LEVEL=DEBUG uvicorn temporallayr.server.app:app --reload --port 8000

dev-all:
	@echo "Start backend: make dev-server"
	@echo "Start dashboard: make dashboard-dev"
	@echo "Start worker: make worker"
