FROM python:3.11-slim

LABEL org.opencontainers.image.title="TemporalLayr Ingest Worker"
LABEL org.opencontainers.image.description="Redis-based async ingest worker for TemporalLayr"

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY src/ src/
COPY workers/ workers/

# Install the package
RUN pip install --no-cache-dir -e ".[clickhouse]"

# Non-root user for security
RUN useradd -r -s /bin/false temporallayr
USER temporallayr

# Health check via Redis ping (worker has no HTTP)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
    CMD python -c "import redis; r=redis.from_url('${TEMPORALLAYR_REDIS_URL:-redis://localhost:6379}'); r.ping()" || exit 1

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TEMPORALLAYR_LOG_LEVEL=INFO

CMD ["python", "workers/ingest_worker.py"]
