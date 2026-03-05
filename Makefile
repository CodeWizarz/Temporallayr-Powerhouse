.PHONY: lint format typecheck test coverage ci

QUALITY_PATHS = \
	src/temporallayr/__init__.py \
	src/temporallayr/client.py \
	src/temporallayr/config.py \
	src/temporallayr/context.py \
	src/temporallayr/decorators.py \
	src/temporallayr/serializer.py \
	src/temporallayr/transport.py \
	src/temporallayr/models \
	src/temporallayr/core/transport_http.py \
	tests

lint:
	ruff check $(QUALITY_PATHS)
	black --check $(QUALITY_PATHS)

format:
	black $(QUALITY_PATHS)
	ruff check --fix $(QUALITY_PATHS)

typecheck:
	mypy src/temporallayr/client.py src/temporallayr/config.py src/temporallayr/context.py src/temporallayr/decorators.py src/temporallayr/serializer.py src/temporallayr/models tests

test:
	PYTHONPATH=src pytest

coverage:
	PYTHONPATH=src coverage run -m pytest
	coverage report -m --fail-under=80

ci: lint typecheck test coverage

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
