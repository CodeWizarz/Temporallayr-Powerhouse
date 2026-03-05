# ── Stage 1: dependency install ──────────────────────────────────────
FROM python:3.11-slim AS deps
WORKDIR /app
COPY pyproject.toml requirements.txt README.md ./
COPY src/ ./src/
RUN pip install --no-cache-dir -e ".[clickhouse,postgres]" && \
    pip install --no-cache-dir uvicorn[standard]

# ── Stage 2: production image ─────────────────────────────────────────
FROM python:3.11-slim AS production
WORKDIR /app
COPY --from=deps /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=deps /usr/local/bin /usr/local/bin
COPY --from=deps /app /app

RUN useradd -m -u 1000 temporallayr && \
    mkdir -p /data/.temporallayr && \
    chown -R temporallayr:temporallayr /app /data

USER temporallayr
EXPOSE 8000

ENV TEMPORALLAYR_DATA_DIR=/data/.temporallayr

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "temporallayr.server.app:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "1", "--log-level", "warning"]