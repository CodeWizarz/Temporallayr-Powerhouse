FROM python:3.12-slim

WORKDIR /app

# Install project with clickhouse extras
COPY pyproject.toml .
COPY src/ src/
COPY workers/ workers/

RUN pip install --no-cache-dir ".[clickhouse]"

# Run the ingest worker
CMD ["python", "-m", "workers.ingest_worker"]
