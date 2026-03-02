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
