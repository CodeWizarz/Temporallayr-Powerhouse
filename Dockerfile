FROM python:3.11-slim

WORKDIR /app

# Install deps first (better layer caching)
COPY pyproject.toml requirements.txt README.md ./
COPY src/ ./src/

RUN pip install --no-cache-dir -e ".[clickhouse]" && \
    pip install --no-cache-dir uvicorn[standard]

COPY . .

# Non-root for security
RUN useradd -m -u 1000 temporallayr && \
    mkdir -p /data/.temporallayr && \
    chown -R temporallayr:temporallayr /app /data

USER temporallayr

EXPOSE 8000

# Persistent volume: mount /data to keep SQLite across redeploys
ENV TEMPORALLAYR_DATA_DIR=/data/.temporallayr

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Single worker — required for SQLite write safety
# Scale horizontally with multiple containers + shared Postgres instead
CMD ["uvicorn", "temporallayr.server.app:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "1", \
     "--log-level", "warning"]
